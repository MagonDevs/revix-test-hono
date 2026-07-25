CREATE EXTENSION IF NOT EXISTS "pg_trgm";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE TYPE "public"."pet_size" AS ENUM('small', 'medium', 'large');--> statement-breakpoint
CREATE TYPE "public"."pet_status" AS ENUM('available', 'reserved', 'adopted', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'accepted', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."sex" AS ENUM('male', 'female', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."species" AS ENUM('dog', 'cat', 'rabbit', 'bird', 'other');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
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
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"city" text NOT NULL,
	"phone" text,
	"bio" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" varchar(40) NOT NULL,
	"species" "species" NOT NULL,
	"breed" varchar(60),
	"sex" "sex" NOT NULL,
	"age_months" smallint NOT NULL,
	"size" "pet_size" NOT NULL,
	"weight_grams" integer,
	"description" text NOT NULL,
	"city" varchar(80) NOT NULL,
	"status" "pet_status" DEFAULT 'available' NOT NULL,
	"is_vaccinated" boolean DEFAULT false NOT NULL,
	"is_neutered" boolean DEFAULT false NOT NULL,
	"is_good_with_kids" boolean DEFAULT false NOT NULL,
	"is_good_with_pets" boolean DEFAULT false NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(breed, '') || ' ' || coalesce(description, ''))) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pets_age_months_check" CHECK ("pets"."age_months" between 0 and 360),
	CONSTRAINT "pets_weight_check" CHECK ("pets"."weight_grams" is null or "pets"."weight_grams" between 100 and 120000)
);
--> statement-breakpoint
CREATE TABLE "pet_photos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"pet_id" uuid NOT NULL,
	"upload_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"alt" varchar(200),
	CONSTRAINT "pet_photos_upload_id_unique" UNIQUE("upload_id"),
	CONSTRAINT "pet_photos_position_check" CHECK ("pet_photos"."position" between 0 and 5)
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"uploader_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" varchar(40) NOT NULL,
	"byte_size" integer NOT NULL,
	"width" smallint NOT NULL,
	"height" smallint NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uploads_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "adoption_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"pet_id" uuid NOT NULL,
	"adopter_id" text NOT NULL,
	"guardian_id" text NOT NULL,
	"message" varchar(1000) NOT NULL,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "adoption_requests_no_self" CHECK ("adoption_requests"."adopter_id" <> "adoption_requests"."guardian_id")
);
--> statement-breakpoint
CREATE TABLE "favourites" (
	"user_id" text NOT NULL,
	"pet_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favourites_user_id_pet_id_pk" PRIMARY KEY("user_id","pet_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_photos" ADD CONSTRAINT "pet_photos_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_photos" ADD CONSTRAINT "pet_photos_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_uploader_id_user_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adoption_requests" ADD CONSTRAINT "adoption_requests_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adoption_requests" ADD CONSTRAINT "adoption_requests_adopter_id_user_id_fk" FOREIGN KEY ("adopter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adoption_requests" ADD CONSTRAINT "adoption_requests_guardian_id_user_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pets_browse_idx" ON "pets" USING btree ("status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "pets_owner_idx" ON "pets" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "pets_city_trgm_idx" ON "pets" USING gin (lower("city") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "pets_search_idx" ON "pets" USING gin ("search_vector");--> statement-breakpoint
CREATE UNIQUE INDEX "pet_photos_position_uq" ON "pet_photos" USING btree ("pet_id","position");--> statement-breakpoint
CREATE INDEX "pet_photos_pet_idx" ON "pet_photos" USING btree ("pet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "adoption_requests_active_uq" ON "adoption_requests" USING btree ("pet_id","adopter_id") WHERE status in ('pending', 'accepted');--> statement-breakpoint
CREATE INDEX "adoption_requests_guardian_idx" ON "adoption_requests" USING btree ("guardian_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "adoption_requests_adopter_idx" ON "adoption_requests" USING btree ("adopter_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "favourites_user_idx" ON "favourites" USING btree ("user_id","created_at" DESC NULLS LAST);