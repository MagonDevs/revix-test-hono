// Module public API (architecture §2.1). Nothing outside this module
// needs favourites data — only the HTTP layer, through the service.

export * as favouritesService from "./favourites.service.js";
