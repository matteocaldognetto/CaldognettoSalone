// Import in correct order to avoid circular dependencies
// User must be imported first since trip and path depend on it
// Trip must come before trip-route since trip-route references trip
// Street must come after path since it references path
import * as userModule from "./user";
import * as tripModule from "./trip";
import * as tripRouteModule from "./trip-route";
import * as tripRatingModule from "./trip-rating";
import * as obstacleModule from "./obstacle";
import * as pathModule from "./path";
import * as streetModule from "./street";

// Re-export everything from each module
export * from "./user";
export * from "./trip";
export * from "./trip-route";
export * from "./trip-rating";
export * from "./obstacle";
export * from "./path";
export * from "./street";

// Create schema object by combining all exports
// This avoids spread operator issues while being maintainable
export const schema = {
  ...userModule,
  ...tripModule,
  ...tripRouteModule,
  ...tripRatingModule,
  ...obstacleModule,
  ...pathModule,
  ...streetModule,
} as const;

export type DbSchema = typeof schema;
export default schema;
