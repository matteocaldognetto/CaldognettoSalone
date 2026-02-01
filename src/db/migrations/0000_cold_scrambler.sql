CREATE TABLE "trip_route" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" text NOT NULL,
	"street_id" text,
	"route_index" integer NOT NULL,
	"name" text NOT NULL,
	"geometry" jsonb NOT NULL,
	"distance" numeric(10, 2) NOT NULL,
	"start_lat" numeric(10, 6) NOT NULL,
	"start_lon" numeric(10, 6) NOT NULL,
	"end_lat" numeric(10, 6) NOT NULL,
	"end_lon" numeric(10, 6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"distance" numeric(10, 2) NOT NULL,
	"avg_speed" numeric(10, 2),
	"max_speed" numeric(10, 2),
	"duration" integer NOT NULL,
	"route" jsonb,
	"weather_data" jsonb,
	"collection_mode" text NOT NULL,
	"is_published" integer DEFAULT 0 NOT NULL,
	"published_path_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	"active_team_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"is_anonymous" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "obstacle_report" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_route_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"lat" numeric(10, 7) NOT NULL,
	"lon" numeric(10, 7) NOT NULL,
	"detection_mode" text NOT NULL,
	"sensor_data" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "path" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trip_id" text,
	"geometry" jsonb,
	"current_status" text,
	"score" numeric(5, 2),
	"score_calculated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "path_report" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"trip_route_id" text,
	"street_name" text,
	"lat" numeric(10, 7),
	"lon" numeric(10, 7),
	"status" text NOT NULL,
	"is_publishable" boolean DEFAULT false NOT NULL,
	"rating" integer,
	"collection_mode" text NOT NULL,
	"sensor_data" jsonb,
	"obstacles" jsonb,
	"is_confirmed" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "path_segment" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path_id" text NOT NULL,
	"street_id" text NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "street" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"geometry" jsonb NOT NULL,
	"is_cyclable" boolean DEFAULT true NOT NULL,
	"speed_limit" integer,
	"current_status" text,
	"city" text,
	"district" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_rating" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" text NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"notes" text,
	"is_published" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_route" ADD CONSTRAINT "trip_route_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_route" ADD CONSTRAINT "trip_route_street_id_street_id_fk" FOREIGN KEY ("street_id") REFERENCES "public"."street"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity" ADD CONSTRAINT "identity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obstacle_report" ADD CONSTRAINT "obstacle_report_trip_route_id_trip_route_id_fk" FOREIGN KEY ("trip_route_id") REFERENCES "public"."trip_route"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obstacle_report" ADD CONSTRAINT "obstacle_report_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "path" ADD CONSTRAINT "path_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "path_report" ADD CONSTRAINT "path_report_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "path_report" ADD CONSTRAINT "path_report_trip_route_id_trip_route_id_fk" FOREIGN KEY ("trip_route_id") REFERENCES "public"."trip_route"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "path_segment" ADD CONSTRAINT "path_segment_path_id_path_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."path"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "path_segment" ADD CONSTRAINT "path_segment_street_id_street_id_fk" FOREIGN KEY ("street_id") REFERENCES "public"."street"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_rating" ADD CONSTRAINT "trip_rating_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_rating" ADD CONSTRAINT "trip_rating_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_route_trip_id_route_index_index" ON "trip_route" USING btree ("trip_id","route_index");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_path_segment_unique" ON "path_segment" USING btree ("path_id","order_index");--> statement-breakpoint
CREATE INDEX "idx_path_segment_path_id" ON "path_segment" USING btree ("path_id");--> statement-breakpoint
CREATE INDEX "idx_path_segment_street_id" ON "path_segment" USING btree ("street_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_trip_rating_unique" ON "trip_rating" USING btree ("trip_id");