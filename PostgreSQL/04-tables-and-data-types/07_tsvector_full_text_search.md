# Full Text Search in PostgreSQL: tsvector, tsquery and GIN

Oct 9, 2026 · @Abdus samad

## 1. Why search in the database, not in React

Search has to run where all the rows are, and the browser never holds all of them.

- **Pagination:** BookEasy shows 12 venues per page. If React only has the current page, `description.includes(text)` can only find venues on that page. A match on page 3 is invisible.
- **Size:** sending every venue to every visitor means megabytes on page load, growing with each new venue, including inactive venues that should stay hidden.
- **Filters:** city, category, price and "free slot on Saturday" need the whole dataset too.
- **Smartness:** `includes()` cannot match `hall` with `halls`, cannot rank results, and cannot use an index (section 2).

It is not extra API calls: a search is one request, like any filter. Wait about 300 ms after the user stops typing (debounce) before sending it.

Client-side filtering is fine for a small list that is already fully loaded, for example the venues of one owner (under about 200 items).

## 2. The problem with LIKE and ILIKE

A plain text search looks for the exact characters you typed, so it misses obvious matches. Our test data:

| id | name | description |
| --- | --- | --- |
| 1 | Royal Palm Marquee | Large hall for weddings and receptions |
| 2 | Margalla Conference Room | Meeting space with projector and wifi |
| 3 | Garden Lawn | Open air lawn for wedding functions and parties |
| 4 | Defence Futsal Arena | Indoor futsal court with floodlights |

The user types **wedding halls**:

```sql
SELECT name FROM venues
WHERE description ILIKE '%wedding halls%' OR name ILIKE '%wedding halls%';
-- 0 rows
```

Venue 1 says "hall for weddings", not the exact text "wedding halls". Full text search finds it (section 6). Plain `ILIKE '%text%'` also:

- ignores word forms: `hall` / `halls`, `wedding` / `weddings`
- cannot match two words that sit in different places of the text
- cannot rank the best match first
- cannot use a normal index when the pattern starts with `%`, so Postgres reads every row

## 3. Vocabulary

Full text search is a few simple ideas with unfamiliar names. Learn these once and the rest reads easily.

| Term | Meaning | Example |
| --- | --- | --- |
| Token | One word cut out of a text | `Large`, `Halls`, `for` |
| Stop word | A very common word that carries no meaning. It is dropped. | `the`, `and`, `for`, `with` |
| Stemming | Cutting a word down to its root so word forms match | `weddings` becomes `wed`, `halls` becomes `hall`, `parties` becomes `parti` |
| Lexeme | A cleaned word as stored, after lowercase and stemming. Not always a real word. | `larg`, `defenc`, `wed` |
| Position | Where a lexeme sat in the original text, counted in words | `'wed':5,7` means words 5 and 7 |
| `tsvector` | A column type that holds a sorted list of lexemes with positions. It is the searchable summary of a text. | `'hall':3 'wed':5` |
| `tsquery` | The same idea for what the user searched: lexemes joined with `&` (and), `\|` (or), `!` (not) | `'wed' & 'hall'` |
| `@@` | The match operator: does this tsvector satisfy this tsquery? | `search @@ query` |
| Text search configuration | The language rules used for stop words and stemming | `'english'`, `'simple'` |

## 4. tsvector and to\_tsvector

`to_tsvector(language, text)` turns a text into a `tsvector`: its words, cleaned, with their positions.

```sql
SELECT to_tsvector('english', 'The Large Halls for Weddings and wedding parties');
-- 'hall':3 'larg':2 'parti':8 'wed':5,7
```

What happened, in order:

1. The text is cut into words: `The, Large, Halls, for, Weddings, and, wedding, parties`.
2. Everything is lowercased.
3. Stop words are dropped: `the`, `for`, `and`. They still use up a position number, which is why `hall` is at 3 and `wed` at 5.
4. Each remaining word is stemmed: `large` becomes `larg`, `halls` becomes `hall`, `weddings` and `wedding` both become `wed`, `parties` becomes `parti`.
5. Each lexeme is stored once, with all its positions: `'wed':5,7`. The list is sorted alphabetically.

One word at a time:

| Input | Result |
| --- | --- |
| `halls` | `'hall':1` |
| `Weddings` | `'wed':1` |
| `the and for` | empty (only stop words) |

The first argument, `'english'`, selects the language rules. A tsvector is only useful if the search text goes through the same cleaning, which is the next section.

## 5. tsquery, the query functions and @@

The search text from the input box must be cleaned exactly like the stored text. A set of functions builds a `tsquery` from it.

```sql
SELECT plainto_tsquery('english', 'wedding halls');
-- 'wed' & 'hall'
```

`plainto_tsquery` cuts the typed text into words, lowercases, drops stop words, stems, and joins everything with AND. A venue must contain all the words. Symbols such as `&`, `!` or quotes in the input are ignored, so a user cannot break the query by typing them. "plain" means: treat the input as plain words.

| Function | What it does | Example input | Result |
| --- | --- | --- | --- |
| `plainto_tsquery` | All words, AND, no special syntax. The safe default for a search box. | `wedding halls` | `'wed' & 'hall'` |
| `websearch_to_tsquery` | Understands Google-style input: quotes for a phrase, minus for exclude, `or` | `wedding -garden "grand hall"` | `'wed' & !'garden' & 'grand' <-> 'hall'` |
| `phraseto_tsquery` | Words must appear next to each other, in order | `hall for weddings` | `'hall' <2> 'wed'` |
| `to_tsquery` | You write the syntax yourself (`&`, `\|`, `!`, `:*`). It errors on bad syntax, so never feed it raw user input. | `wedding & hall` | `'wed' & 'hall'` |

### The match operator

```sql
SELECT to_tsvector('english', 'Large hall for weddings') @@ plainto_tsquery('english', 'wedding halls');  -- true
SELECT to_tsvector('english', 'Large hall for weddings') @@ plainto_tsquery('english', 'cricket');         -- false
```

`vector @@ query` returns true when the vector satisfies the query. "wedding halls" finds "hall for weddings" because both sides were reduced to `wed` and `hall`.

### Edge cases I tested

- A query made only of stop words (`the and`) becomes empty and Postgres prints a NOTICE. Check for an empty search text in your API and skip the filter.
- Phrase search is strict about distance. A stop word still takes up a position, so `hall weddings` does not match "hall for weddings" (false), while `hall for weddings` does (true).
- Partial words are unreliable with `'english'`. Typing `wedd` becomes the stem `wedd`, which is not a prefix of the stored `wed`, so it finds nothing. Full text search matches whole lexemes. Autocomplete needs a different tool (`pg_trgm`, a later topic).

## 6. The BookEasy search column, piece by piece

The column is a ready-made, always up-to-date searchable summary of each venue.

```sql
search TSVECTOR GENERATED ALWAYS AS (
  to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,''))
) STORED
```

| Piece | Meaning |
| --- | --- |
| `search TSVECTOR` | A column whose type is tsvector |
| `name \|\| ' ' \|\| description` | Glue the name and the description into one text. The `' '` keeps the last word of the name from touching the first word of the description. |
| `coalesce(x, '')` | Use empty text when `x` is NULL. In Postgres `'abc' \|\| ' ' \|\| NULL` is NULL (tested), which would erase the whole search text. In our schema both columns are `NOT NULL`, so here it is only a safety net. |
| `to_tsvector('english', ...)` | Clean the glued text into lexemes (section 4) |
| `GENERATED ALWAYS AS (...)` | You never fill this column. Postgres computes it from other columns of the same row. |
| `STORED` | Compute it once when the row is inserted or updated, and keep it on disk. Searches then read it without recomputing. |

### What is stored for our test venues

| name | search column |
| --- | --- |
| Royal Palm Marquee | `'hall':5 'larg':4 'marque':3 'palm':2 'recept':9 'royal':1 'wed':7` |
| Garden Lawn | `'air':4 'function':8 'garden':1 'lawn':2,5 'open':3 'parti':10 'wed':7` |
| Defence Futsal Arena | `'arena':3 'court':6 'defenc':1 'floodlight':8 'futsal':2,5 'indoor':4` |

### It stays in sync, and you cannot write to it

When I changed a description to "Cricket ground with pavilion", the search column became `'arena' 'cricket' 'defenc' 'futsal' 'ground' 'pavilion'` with no extra code. Writing to it is refused:

```text
ERROR: column "search" can only be updated to DEFAULT
DETAIL: Column "search" is a generated column.
```

### Using it

```sql
SELECT name FROM venues
WHERE search @@ plainto_tsquery('english', 'wedding halls');
-- Royal Palm Marquee   (ILIKE returned 0 rows)
```

The input box never touches the column. The API turns the typed text into a tsquery, and `@@` compares it with each venue's stored `search` value.

## 7. The GIN index

A GIN index makes `@@` fast by storing, for each lexeme, the list of rows that contain it.

```sql
CREATE INDEX venues_search_idx ON venues USING gin (search);
```

Think of the index at the back of a book: look up `wed`, and it points straight to the pages. Without it, Postgres reads every row and runs the comparison on each one.

To check that Postgres uses it:

```sql
EXPLAIN SELECT id FROM venues WHERE search @@ plainto_tsquery('english', 'wedding');
-- Bitmap Index Scan on venues_search_idx
--   Index Cond: (search @@ '''wed'''::tsquery)
```

On a table of four rows Postgres may prefer reading the whole table because it is tiny. I forced the index (`SET enable_seqscan = off`) to show that it can be used. On thousands of rows it chooses the index by itself.

A normal B-tree index cannot do this. It orders whole values, and a tsvector is a bag of many lexemes per row, which is the case GIN is built for.

## 8. Ranking and weights

`@@` only says match or no match. `ts_rank` gives a relevance score so the best results can come first.

```sql
SELECT name, ts_rank(search, plainto_tsquery('english', 'wedding')) AS rank
FROM venues
WHERE search @@ plainto_tsquery('english', 'wedding')
ORDER BY rank DESC;
```

In my test both matching venues scored 0.0608, a tie, because each mentions "wedding" once. With more text the scores separate: more occurrences rank higher.

### Weights: a name match should count more

`setweight` labels lexemes A, B, C or D (A is the heaviest). Build the vector from two parts:

```sql
setweight(to_tsvector('english', coalesce(name,'')), 'A') ||
setweight(to_tsvector('english', coalesce(description,'')), 'B')
```

Result for "Royal Palm Marquee" + "Large hall for weddings":

```text
'hall':5B 'larg':4B 'marque':3A 'palm':2A 'royal':1A 'wed':7B
```

`ts_rank` now scores a hit in the name (A) above a hit in the description (B). Our first migration uses the simple version without weights. Switching later is a new migration, not an edit of the old one.

### Highlighting

```sql
SELECT ts_headline('english', description, plainto_tsquery('english', 'wedding'),
                   'StartSel=<b>,StopSel=</b>')
FROM venues;
-- Large hall for <b>weddings</b> and receptions
```

## 9. Using it from Node with pg

The search is one SQL query. Node only builds it and passes the user's text as a parameter, so the text is never glued into the SQL string and SQL injection is not possible.

```ts
import { pool } from '../db/pool';

type SearchParams = {
  q?: string;
  city?: string;
  category?: string;
  page?: number;
  limit?: number;
};

export async function searchVenues({ q, city, category, page = 1, limit = 10 }: SearchParams) {
  const where: string[] = ['v.is_active = true'];
  const params: unknown[] = [];

  // No search text -> no search condition and no ranking
  let orderBy = 'v.id DESC';
  if (q && q.trim()) {
    params.push(q.trim());
    where.push(`v.search @@ plainto_tsquery('english', $${params.length})`);
    orderBy = `ts_rank(v.search, plainto_tsquery('english', $${params.length})) DESC, v.id DESC`;
  }
  if (city) {
    params.push(city);
    where.push(`v.city = $${params.length}`);
  }
  if (category) {
    params.push(category);
    where.push(`v.category = $${params.length}`);
  }

  params.push(limit, (page - 1) * limit);
  const sql = `
    SELECT v.id, v.name, v.city, v.category, count(*) OVER() AS total
    FROM venues v
    WHERE ${where.join(' AND ')}
    ORDER BY ${orderBy}
    LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await pool.query(sql, params);
  return {
    items: rows.map(({ total, ...venue }) => venue),
    total: rows[0] ? Number(rows[0].total) : 0,
  };
}
```

I ran this against a test table. Searching `wedding halls` returned only the wedding hall, `wedding` plus city Lahore returned two venues, a filter-only call worked, and the input `'; DROP TABLE venues; --` was treated as plain words and returned nothing.

### What each part does

- **`where` array:** every filter is optional. Each one adds a condition and a parameter, and the conditions are joined with `AND`.
- **`$1`, `$2` placeholders:** `pg` sends the SQL and the values separately. The database never reads the user's text as SQL.
- **`${params.length}`:** the placeholder number is always the position of the value just pushed, so the numbers stay correct whichever filters are present.
- **`count(*) OVER() AS total`:** a window function. It puts the total number of matches (before `LIMIT`) on every row, so one query gives both the page and the total for pagination buttons.
- **`LIMIT` and `OFFSET`:** page 3 with limit 10 means `OFFSET 20`.
- **Skip the search when the text is empty:** `plainto_tsquery('english', '')` gives an empty query and matches nothing. Without text you want all venues, so the condition is simply left out.
- **No `ORDER BY` rank without text:** ordering by a constant like `0` is an error in Postgres (`ORDER BY position 0 is not in select list`). Only add `ts_rank` when there is search text.

### On the frontend

- Send the search text as a query string: `GET /venues?q=wedding&city=Lahore&page=1`.
- Debounce the input by about 300 ms so you do not send a request on every keystroke.
- Validate the query string with zod on the backend (`q` max 100 characters, `limit` max 50) before calling the function.

## 10. Language config, limits and when to use what

### english vs simple

The first argument of `to_tsvector` and the query functions is the language configuration. It decides the stop words and the stemming.

| Config | Stop words | Stemming | Use for |
| --- | --- | --- | --- |
| `'english'` | removed (the, for, a) | yes (`halls` becomes `hall`) | English text. This is the BookEasy default. |
| `'simple'` | none removed | none, only lowercase | Names, codes, mixed languages, Roman Urdu |

- The config used in the column, the index and the query must match. If the column uses `'english'` and the query uses `'simple'`, words with different stems will not match.
- BookEasy venue names and descriptions are written in English, so `'english'` is right. If owners start writing Roman Urdu (`shadi hall`), the English stemmer does not understand it. Use `'simple'` for those texts, or keep both.

### Limits you will notice

- **Partial words do not match with `english`.** `wedd:*` finds nothing because the stored lexeme is `wed`. `wed:*` works. Full text search matches whole words (after stemming), not half-typed words.
- **Typos do not match.** `weding` is not `wedding`. Full text search has no fuzzy matching.
- **Stop words keep their position.** The phrase `hall weddings` does not match `hall for weddings`, because the gap left by `for` still counts.
- **A query of only stop words is empty.** Searching `the` gives an empty query, a NOTICE, and zero rows.
- **Short text only gets cheap ranking.** `ts_rank` is good enough for a venue list, but it is not a full search engine's relevance score.

### When to use what

| Situation | Use |
| --- | --- |
| Search words in names and descriptions (BookEasy venues) | Full text search with a GIN index |
| Search-as-you-type, half-typed words, typo tolerance | `pg_trgm` extension with `ILIKE` or `%` similarity |
| A tiny list already loaded in the browser (under about 100 items) | `includes` in React |
| Exact filters (city, category, price range) | Plain `=` and `BETWEEN` with a normal index |
| Millions of documents, facets, advanced relevance | A search engine such as Elasticsearch or Meilisearch (not needed for this project) |

For BookEasy the plan is full text search for the main search box and plain filters for city and category, which is exactly what the Node function in section 9 does.

## 11. Cheat sheet and common mistakes

### Cheat sheet

| You want to | Write |
| --- | --- |
| Turn text into searchable form | `to_tsvector('english', text)` |
| Turn user input into a query (safe, plain words) | `plainto_tsquery('english', input)` |
| Support quotes, `or` and `-word` like Google | `websearch_to_tsquery('english', input)` |
| Words in an exact order | `phraseto_tsquery('english', input)` |
| Match a word start (stemmed form) | `to_tsquery('english', 'wed:*')` |
| Test a match | `search @@ query` |
| Store it once, keep it in sync | `search tsvector GENERATED ALWAYS AS (...) STORED` |
| Make it fast | `CREATE INDEX ... USING GIN (search)` |
| Sort by relevance | `ORDER BY ts_rank(search, query) DESC` |
| Make name matter more than description | `setweight(..., 'A')` and `setweight(..., 'B')` |
| Show the matched part with highlights | `ts_headline('english', text, query)` |

### Common mistakes

1. **Using `LIKE '%word%'` for search.** It cannot use a normal index, it does not understand word forms, and it is slow on large tables. Use `@@`.
2. **Forgetting the GIN index.** Search still works but reads every row. Always create the index on the `tsvector` column.
3. **Different configs in the column and the query.** Use the same config (`'english'`) everywhere.
4. **Not wrapping nullable columns in `coalesce`.** If `description` is `NULL`, the whole concatenation becomes `NULL` and the row is never found.
5. **Pasting user text into the SQL string.** Always pass it as a parameter (`$1`). `plainto_tsquery` is safe for any input, but string building is not.
6. **Using `to_tsquery` with raw user input.** Characters like `&`, `:` or `'` can cause a syntax error. Use `plainto_tsquery` or `websearch_to_tsquery`.
7. **Searching with an empty string.** The query matches nothing. Skip the search condition when the box is empty.
8. **`ORDER BY` a constant when there is no search text.** Only add the rank term when a query exists.
9. **Expecting partial words and typos to work.** They do not. Use `pg_trgm` if you need that later.
10. **Computing `to_tsvector(...)` inside every query instead of storing it.** The generated column does this once, on write.
