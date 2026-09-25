import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  timestamp,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const gyms = pgTable("gyms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
}).enableRLS();

export const walls = pgTable("walls", {
  id: uuid("id").primaryKey().defaultRandom(),
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gyms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
}).enableRLS();

export const gradeScale = pgTable("grade_scale", {
  id: uuid("id").primaryKey().defaultRandom(),
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gyms.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  colorHint: text("color_hint"),
  defaultPoints: integer("default_points").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
}).enableRLS();

export const sets = pgTable("sets", {
  id: uuid("id").primaryKey().defaultRandom(),
  gymId: uuid("gym_id")
    .notNull()
    .references(() => gyms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  setDate: timestamp("set_date", { withTimezone: true }).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
}).enableRLS();

export const photos = pgTable("photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  setId: uuid("set_id")
    .notNull()
    .references(() => sets.id, { onDelete: "cascade" }),
  wallId: uuid("wall_id").references(() => walls.id, {
    onDelete: "set null",
  }),
  storagePath: text("storage_path").notNull(),
  thumbPath: text("thumb_path"),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  caption: text("caption"),
  sortOrder: integer("sort_order").notNull().default(0),
}).enableRLS();

export const routeStatusValues = ["active", "archived"] as const;
export type RouteStatus = (typeof routeStatusValues)[number];

export const routes = pgTable("routes", {
  id: uuid("id").primaryKey().defaultRandom(),
  setId: uuid("set_id")
    .notNull()
    .references(() => sets.id, { onDelete: "cascade" }),
  photoId: uuid("photo_id")
    .notNull()
    .references(() => photos.id, { onDelete: "cascade" }),
  pinX: real("pin_x").notNull(),
  pinY: real("pin_y").notNull(),
  color: text("color").notNull(),
  gradeId: uuid("grade_id").references(() => gradeScale.id, {
    onDelete: "set null",
  }),
  pointsOverride: integer("points_override"),
  name: text("name"),
  setterId: uuid("setter_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  notes: text("notes"),
  status: text("status", { enum: routeStatusValues })
    .notNull()
    .default("active"),
}).enableRLS();

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  authId: uuid("auth_id").unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  isAdmin: boolean("is_admin").notNull().default(false),
}).enableRLS();

export const sendStyleValues = ["flash", "redpoint", "repeat"] as const;
export type SendStyle = (typeof sendStyleValues)[number];

export const sends = pgTable(
  "sends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    routeId: uuid("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    sentAt: timestamp("sent_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    attempts: integer("attempts"),
    style: text("style", { enum: sendStyleValues }),
    notes: text("notes"),
  },
  (table) => [uniqueIndex("sends_profile_route_unique").on(table.profileId, table.routeId)]
).enableRLS();
