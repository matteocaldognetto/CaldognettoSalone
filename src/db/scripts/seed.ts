import { drizzle, schema } from "@repo/db";
import postgres from "postgres";
import { hashPassword } from "better-auth/crypto";

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });

/**
 * E2E test user credentials — must match e2e/utils/test-data.ts
 */
const E2E_USER = {
  email: "e2e-test@example.com",
  password: "TestPassword123!",
  name: "E2E Test User",
};

async function seed() {
  console.log("Seeding demo data...");

  try {
    // ——— Create demo users ———
    console.log("Creating demo users...");
    const [user1, user2, user3] = await db
      .insert(schema.user)
      .values([
        {
          name: "Alice Cyclist",
          email: "alice@example.com",
          emailVerified: false,
        },
        {
          name: "Bob Biker",
          email: "bob@example.com",
          emailVerified: false,
        },
        {
          name: "Charlie Commuter",
          email: "charlie@example.com",
          emailVerified: false,
        },
      ])
      .onConflictDoNothing()
      .returning();

    console.log(
      `Created ${[user1, user2, user3].filter(Boolean).length} users`,
    );

    if (!user1 || !user2 || !user3) {
      console.log("Users already exist, skipping user-dependent data...");
    }

    // ——— Create E2E test user with credentials ———
    console.log("Creating E2E test user...");
    const [e2eUser] = await db
      .insert(schema.user)
      .values({
        name: E2E_USER.name,
        email: E2E_USER.email,
        emailVerified: true,
      })
      .onConflictDoNothing()
      .returning();

    if (e2eUser) {
      // Create credential identity with hashed password
      const hashedPassword = await hashPassword(E2E_USER.password);
      await db
        .insert(schema.identity)
        .values({
          accountId: e2eUser.id,
          providerId: "credential",
          userId: e2eUser.id,
          password: hashedPassword,
        })
        .onConflictDoNothing();

      console.log(`Created E2E user: ${E2E_USER.email}`);
    } else {
      console.log("E2E user already exists, skipping...");
    }

    // ——— Create demo paths ———
    console.log("Creating demo paths...");
    const [path1, path2, path3] = await db
      .insert(schema.path)
      .values([
        {
          name: "Main Street Bike Lane",
          description: "Protected bike lane through downtown",
          currentStatus: "optimal",
          geometry: {
            type: "LineString",
            coordinates: [
              [9.19, 45.464],
              [9.195, 45.465],
              [9.2, 45.466],
            ],
          },
        },
        {
          name: "Park Avenue Trail",
          description: "Scenic route along the park",
          currentStatus: "medium",
          geometry: {
            type: "LineString",
            coordinates: [
              [9.18, 45.46],
              [9.185, 45.462],
              [9.19, 45.464],
            ],
          },
        },
        {
          name: "Riverside Path",
          description: "Path along the river with great views",
          currentStatus: "requires_maintenance",
          geometry: {
            type: "LineString",
            coordinates: [
              [9.2, 45.47],
              [9.21, 45.472],
              [9.22, 45.474],
            ],
          },
        },
      ])
      .onConflictDoNothing()
      .returning();

    console.log(
      `Created ${[path1, path2, path3].filter(Boolean).length} paths`,
    );

    // ——— Create path reports (standalone, using streetName/lat/lon) ———
    if (user1 && user2 && user3) {
      console.log("Creating path reports...");

      // Reports for Main Street area — optimal consensus
      await db.insert(schema.pathReport).values([
        {
          userId: user1.id,
          streetName: "Main Street Bike Lane",
          lat: "45.4640000",
          lon: "9.1900000",
          status: "optimal",
          collectionMode: "manual",
          isPublishable: true,
          isConfirmed: true,
        },
        {
          userId: user2.id,
          streetName: "Main Street Bike Lane",
          lat: "45.4650000",
          lon: "9.1950000",
          status: "optimal",
          collectionMode: "manual",
          isPublishable: true,
          isConfirmed: true,
        },
      ]);

      // Reports for Park Avenue — mixed (medium majority)
      await db.insert(schema.pathReport).values([
        {
          userId: user1.id,
          streetName: "Park Avenue Trail",
          lat: "45.4600000",
          lon: "9.1800000",
          status: "medium",
          collectionMode: "manual",
          obstacles: [
            { location: "Near intersection", description: "Small pothole" },
          ],
          isPublishable: true,
          isConfirmed: true,
        },
        {
          userId: user2.id,
          streetName: "Park Avenue Trail",
          lat: "45.4620000",
          lon: "9.1850000",
          status: "medium",
          collectionMode: "automated",
          sensorData: { accelerometer: [{ x: 0.1, y: 0.2, z: 9.8 }] },
          isPublishable: true,
          isConfirmed: true,
        },
        {
          userId: user3.id,
          streetName: "Park Avenue Trail",
          lat: "45.4640000",
          lon: "9.1900000",
          status: "requires_maintenance",
          collectionMode: "manual",
          obstacles: [
            { location: "Multiple areas", description: "Poor surface" },
          ],
          isPublishable: true,
          isConfirmed: true,
        },
      ]);

      // Reports for Riverside — requires maintenance (unanimous)
      await db.insert(schema.pathReport).values([
        {
          userId: user1.id,
          streetName: "Riverside Path",
          lat: "45.4700000",
          lon: "9.2000000",
          status: "requires_maintenance",
          collectionMode: "automated",
          obstacles: [
            { location: "Throughout", description: "Cracks and potholes" },
          ],
          sensorData: { accelerometer: [{ x: 2.5, y: 0.3, z: 9.9 }] },
          isPublishable: true,
          isConfirmed: true,
        },
        {
          userId: user3.id,
          streetName: "Riverside Path",
          lat: "45.4720000",
          lon: "9.2100000",
          status: "requires_maintenance",
          collectionMode: "manual",
          obstacles: [
            {
              location: "Multiple sections",
              description: "Needs resurfacing",
            },
          ],
          isPublishable: true,
          isConfirmed: true,
        },
      ]);

      console.log("Created 7 path reports");

      // ——— Create demo trips ———
      console.log("Creating demo trips...");
      await db.insert(schema.trip).values([
        {
          userId: user1.id,
          name: "Morning Commute",
          startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
          endTime: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
          distance: "5000",
          avgSpeed: "18.5",
          maxSpeed: "28.0",
          duration: 1620,
          collectionMode: "manual",
          route: {
            type: "LineString",
            coordinates: [
              [9.19, 45.464],
              [9.2, 45.466],
            ],
          },
          weatherData: {
            condition: "sunny",
            temperature: 22,
          },
        },
        {
          userId: user1.id,
          name: "Evening Ride",
          startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
          endTime: new Date(Date.now() - 23.5 * 60 * 60 * 1000),
          distance: "8200",
          avgSpeed: "16.4",
          maxSpeed: "25.5",
          duration: 1800,
          collectionMode: "manual",
          route: {
            type: "LineString",
            coordinates: [
              [9.18, 45.46],
              [9.22, 45.474],
            ],
          },
          weatherData: {
            condition: "cloudy",
            temperature: 18,
          },
        },
      ]);

      console.log("Created 2 demo trips");
    }

    console.log("\nSeed completed successfully!");
    console.log("\nDemo accounts created:");
    console.log("   alice@example.com (no password)");
    console.log("   bob@example.com (no password)");
    console.log("   charlie@example.com (no password)");
    console.log(`   ${E2E_USER.email} (password: ${E2E_USER.password})`);

    // Clear E2E auth state to force re-authentication on next test run
    try {
      const fs = await import("fs");
      const path = await import("path");
      const authFile = path.join(
        process.cwd(),
        "../e2e/.auth/user.json",
      );
      if (fs.existsSync(authFile)) {
        fs.unlinkSync(authFile);
        console.log("\n✓ Cleared E2E auth state (will regenerate on next test run)");
      }
    } catch (e) {
      // Ignore errors if e2e directory doesn't exist
    }
  } catch (error) {
    console.error("Seed failed:", error);
    throw error;
  } finally {
    await client.end();
  }
}

seed();
