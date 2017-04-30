# Map Generation Guide

The game requires:
 1. A logical route map which restricts the sprites' movement to certain straight lines.  Currently this is not explicitly displayed to the player, but can be inferred by watching the sprites' progress.
 2. A cosmetic background map which is displayed to the player.

The cosmetic map is in `public/map.svg`, and a logical map is internally represented as an adjacency list in `public/adj_graph.js`. There are two means to create logical maps:

 1. Source route data from OpenStreetMap
 2. Using a vector graphics editor (here Inkscape), draw straight-line paths

## OpenStreetMap

[OpenStreetMap](http://www.openstreetmap.org) is a crowdsourced and freely editable map of the world, licensed under the [Open Database Licence](http://www.openstreetmap.org/copyright). The data is free to use, so long as the application credits the OpenStreetMap contributors and is distributed under the same license.

The website [Overpass Turbo](http://overpass-turbo.eu/) provides a useful interactive query interface to OpenStreetMap data. The user constructs a text query in the left-hand pane, and views the corresponding features in the right-hand pane. Documentation for the OpenStreetMap query language can be found [here](http://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL). One sample query output is provided of Oxford city center (postcode OX1 3BW) in `map-gen/bbox_oxford.geojson`.

To view the query online which generated this output, go [here](http://overpass-turbo.eu/s/oJs), which selects for public roads within a bounding box over Oxford. File `map-gen/overpass_turbo_query.txt` contains a copy of this query text. Further, we assume the OpenStreetMap data to export to .geojson. To achieve this on Overpass Turbo click on the "Export" tab along the top and select "geoJSON".

The script `map-gen/geojson_converter.py`:
1. Provides some simplification of the data
2. Produces an adjacency graph
3. Produces a simple cosmetic map matching the data

While the raw route data extracted from OpenStreetMap essentially captures the structure of the road network, it's often incomplete. For example, an isolated path will cause any sprites generated there to simply walk up and down indefinitely. The Python library networkx filters out [connected components](https://en.wikipedia.org/wiki/Connected_component_%28graph_theory%29) with a node count below a specified threshold (command line option flag --min-cc-size, defaults to 100).

The cosmetic map SVG colours are based on the OpenStreetMap 'highway' distinction (specified in the dictionary called "route_colour")

Example usage: python geojson_converter.py bbox_oxford.geojson
Dependencies: json, networkx, svgwrite, argparse. Install with pip (Python package manager)

#### Advantages:
* No manual path tracing or vector drawing
* A player can recognise features from familiar places

#### Disadvantages:
* Since individual segments in OpenStreetMap tend to be short, the map bounding box has to be quite small, otherwise the graph complexity becomes intractable. This limits the potential of making maps representing large areas.
* Lack of control over the map structure. The game places great emphasis on the map to direct the player's strategy, and sourcing real world data discards the subtly necessary for good level design. For example, if variations in road density are too obvious to the player, they won't have many sensible options of where to put towers. Sprites tend to cluster around dense networks.
 * The cosmetic map, without intervention, only contains straight lines so looks somewhat artificial.

> output needs modifying to match adj_graph.js

## Using Inkscape

[Inkscape](https://inkscape.org/) is a free, open-source vector graphics editor. Here, Inkscape serves a "level editor" using SVG. The logical map and the cosmetic map reside in the same file, but in different [layers](https://en.wikipedia.org/wiki/Layers_(digital_image_editing)).

Although all the lines and curve in the images below required manual drawing, a part of central London (postcode SE1 7PB) served as a guide for the road trajectories. The tiled map images were sourced from OpenStreetMap. The default map size is currently 450px by 450 px.

Paths in SVG cannot have branches (as in, one point with more than two lines meeting there). However the logical map requires this, otherwise the sprites would be restricted to all walking around one big circle. The level designer is expected to use the path tool and draw segments representing the logical map (here, displayed as a black overlay).

To this end, the script `map-gen/create_adj_map.py` gets the layer called 'lines' within the `public/map.svg` and:
1. Merges nearby nodes
2. Produces an adjacency graph

Because the human tracing is imperfect, two points designed to be at the same intersection will be some way apart numerically. The current threshold is ten pixels separation. Be aware that nodes are only merged when two *points* coincide, not a point and a line.

On the other layers, you can add additional, non-interactive features like the river, rail lines, parks, or well known landmarks. Here there is only a segment on the Thames.

Example usage: python create_adj_map.py
Dependencies: json, networkx, argparse. Install with pip (Python package manager)

#### Advantages:
 * Gives much more control over the map structure

#### Disadvantages:
 * Takes time to draw

> check the sodipodi:nodetypes and reject any not matching `c+`