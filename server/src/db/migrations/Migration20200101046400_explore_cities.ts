import { Migration } from '@mikro-orm/migrations';

/**
 * Explore cities: a shared catalogue of places with sourced measurements.
 * Numbered after Migration20200101046310, the last migration on main when
 * this branch was merged.
 */
export class Migration20200101046400_explore_cities extends Migration {
  override name = 'Migration20200101046400_explore_cities';

  override up(): void {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS cities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        country_code TEXT NOT NULL,
        country_name TEXT,
        regions_json TEXT,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        population INTEGER,
        timezone TEXT,
        elevation_m REAL,
        geoname_id INTEGER,
        geo_name TEXT,
        languages_json TEXT,
        english_official INTEGER,
        english_used INTEGER,
        facts_source TEXT,
        facts_license TEXT,
        facts_fetched_at TEXT,
        geo_source TEXT,
        geo_license TEXT,
        geo_fetched_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    this.addSql(`
      CREATE TABLE IF NOT EXISTS city_metrics (
        city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
        metric TEXT NOT NULL,
        value REAL NOT NULL,
        unit TEXT,
        source TEXT NOT NULL,
        source_url TEXT,
        license TEXT,
        fetched_at TEXT NOT NULL,
        period TEXT,
        scope TEXT NOT NULL,
        detail_json TEXT,
        PRIMARY KEY (city_id, metric)
      )
    `);
    this.addSql(`
      CREATE TABLE IF NOT EXISTS city_climate (
        city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
        month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
        temp_mean_c REAL,
        temp_min_c REAL,
        temp_max_c REAL,
        precip_mm REAL,
        source TEXT NOT NULL,
        source_url TEXT,
        license TEXT,
        fetched_at TEXT NOT NULL,
        period TEXT,
        PRIMARY KEY (city_id, month)
      )
    `);
    this.addSql('CREATE INDEX IF NOT EXISTS idx_cities_country ON cities(country_code)');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_city_metrics_metric ON city_metrics(metric)');
    this.addSql(`
      INSERT OR IGNORE INTO addons (id, name, description, type, icon, enabled, config, sort_order)
      VALUES (
        'cities',
        'Cities',
        'Compare cities using open cost, climate, safety, and connectivity data',
        'global',
        'MapPinned',
        1,
        '{}',
        36
      )
    `);
  }
}
