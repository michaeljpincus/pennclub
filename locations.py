import pandas as pd
import geopandas as gpd

# Read CSV
df = pd.read_csv("your_file.csv")

# Convert to GeoDataFrame
gdf = gpd.GeoDataFrame(
    df,
    geometry=gpd.points_from_xy(df["lon"], df["lat"]),
    crs="EPSG:4326"
)

# View GeoDataFrame
print(gdf.head())