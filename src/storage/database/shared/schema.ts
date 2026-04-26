import { pgTable, serial, timestamp, varchar, text, integer, boolean, numeric, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"


export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 站点表
export const sites = pgTable(
	"sites",
	{
		id: serial().primaryKey(),
		name: varchar("name", { length: 255 }).notNull(),
		base_url: varchar("base_url", { length: 500 }).notNull(),
		description: text("description"),
		is_active: boolean("is_active").default(true).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("sites_name_idx").on(table.name),
		index("sites_is_active_idx").on(table.is_active),
	]
);

// 账号表
export const accounts = pgTable(
	"accounts",
	{
		id: serial().primaryKey(),
		site_id: integer("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
		username: varchar("username", { length: 255 }).notNull(),
		password: varchar("password", { length: 255 }).notNull(),
		api_key: text("api_key"),
		token: text("token"),
		session: text("session"),
		remote_user_id: integer("remote_user_id"),
		balance: numeric("balance", { precision: 10, scale: 4 }).default("0").notNull(),
		is_active: boolean("is_active").default(true).notNull(),
		last_error: text("last_error"),
		balance_updated_at: timestamp("balance_updated_at", { withTimezone: true }),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("accounts_site_id_idx").on(table.site_id),
		index("accounts_is_active_idx").on(table.is_active),
		index("accounts_balance_idx").on(table.balance),
	]
);

// 用户 Key 表
export const userKeys = pgTable(
	"user_keys",
	{
		id: serial().primaryKey(),
		key_value: varchar("key_value", { length: 100 }).notNull().unique(),
		name: varchar("name", { length: 255 }),
		is_active: boolean("is_active").default(true).notNull(),
		usage_count: integer("usage_count").default(0).notNull(),
		balance_limit: numeric("balance_limit", { precision: 10, scale: 4 }),
		used_balance: numeric("used_balance", { precision: 10, scale: 4 }).default("0").notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("user_keys_key_value_idx").on(table.key_value),
		index("user_keys_is_active_idx").on(table.is_active),
	]
);

// 调用日志表
export const callLogs = pgTable(
	"call_logs",
	{
		id: serial().primaryKey(),
		user_key_id: integer("user_key_id").references(() => userKeys.id, { onDelete: "set null" }),
		account_id: integer("account_id").references(() => accounts.id, { onDelete: "set null" }),
		prompt: text("prompt"),
		model: varchar("model", { length: 100 }),
		success: boolean("success").default(false).notNull(),
		error_message: text("error_message"),
		cost: numeric("cost", { precision: 10, scale: 4 }),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("call_logs_user_key_id_idx").on(table.user_key_id),
		index("call_logs_account_id_idx").on(table.account_id),
		index("call_logs_created_at_idx").on(table.created_at),
		index("call_logs_success_idx").on(table.success),
	]
);

// 设置表
export const settings = pgTable(
	"settings",
	{
		key: varchar("key", { length: 100 }).primaryKey(),
		value: text("value").notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	}
);

// 类型导出
export type Site = typeof sites.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type UserKey = typeof userKeys.$inferSelect;
export type CallLog = typeof callLogs.$inferSelect;
export type Setting = typeof settings.$inferSelect;
