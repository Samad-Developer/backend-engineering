import type {
  ColumnDefinitions,
  MigrationBuilder,
} from "node-pg-migrate";

export const shorthands:
  ColumnDefinitions | undefined =
  undefined;

export async function up(
  pgm: MigrationBuilder
): Promise<void> {
  pgm.renameColumn(
    "customers",
    "name",
    "full_name"
  );
}

export async function down(
  pgm: MigrationBuilder
): Promise<void> {
  pgm.renameColumn(
    "customers",
    "full_name",
    "name"
  );
}