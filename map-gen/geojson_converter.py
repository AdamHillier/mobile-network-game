import json
import networkx as nx
import svgwrite
import argparse

#python geojson_converter.py bbox_oxford.geojson --latitude 51.7541373 --longitude -1.2537001

# Handle command line arguments
parser = argparse.ArgumentParser()
parser.add_argument("--min-cc-size", type=int, default=100,
  help="minimum number of nodes for a connected component to appear in the road map")
parser.add_argument('infile',
  help="specify a geojson file, as exported from overpass-turbo.eu")
parser.add_argument("--latitude", type=float, required=True, help="The latitude of your bounding box center")
parser.add_argument("--longitude", type=float, required=True, help="The longitude of your bounding box center")
args = parser.parse_args()

# Extract open street map road graph
with open(args.infile, 'r') as fh:
    contents = fh.read().replace('\n', '')
osmap = json.loads(contents)

G = nx.Graph()
for feature in osmap['features']:
  geo = feature['geometry']
  if (geo['type'] == "LineString"):
    way = geo['coordinates']
    for u, v in zip(way, way[1:]):
      c1, c2 = tuple(u), tuple(v)      
      G.add_edge(c1, c2)

# Remove connected components with sufficiently low node count
components = nx.connected_components(G)
islands = (c for c in components if len(c)<args.min_cc_size)
nodes_to_remove = set().union(*islands)
G.remove_nodes_from(nodes_to_remove)

# map over a coordinate transform
center_lat = args.latitude
center_lon = args.longitude
def rescale(lon, lat):
  return (int((lon-center_lon)*4*10**4), \
          int((center_lat-lat)*4*10**4) )

# renumber the nodes from 0
coord_to_node = dict((v, i) for i, v in enumerate(G.nodes()))
adj_list = list(list(coord_to_node[c] for c in adj) for adj in G.adjacency_list())
rescaled_nodes = map(lambda coord: rescale(*coord), G.nodes())

offset_x, offset_y = map(min, zip(*rescaled_nodes))
rescaled_offset_nodes = map(lambda (x,y): (x-offset_x, y-offset_y), rescaled_nodes)

# Produce the adjacency graph for game.js
wrapped = {}
wrapped['osm_adjacency'] = adj_list
wrapped['osm_nodes'] = rescaled_offset_nodes

with open('../public/adj_graph.js', 'w') as fh:
  fh.write("ADJ_GRAPH=")
  fh.write(json.dumps(wrapped, separators=(',', ':')))

# Produce the background road map
dwg = svgwrite.Drawing(filename="../public/map.svg", size=("800px", "450px"))

# Define a parent group for all roads
roadmap = dwg.add(dwg.g(id='roads',
                        stroke='black',
                        stroke_width=2,
                        fill='none'))

# Choose road colours based on the 'highway' value
# ref http://www.december.com/html/spec/colorsvg.html
route_colour = {'primary': 'red',
                'tertiary': 'blue',
                'residential': 'orange',
                'footway': 'green'
               }

for feature in osmap['features']:
  geo = feature['geometry']
  if (geo['type'] == "LineString"):
    nodes = geo['coordinates']
    props = feature['properties']
    a = map(lambda coord: tuple(rescale(*coord)), nodes)
    b = map(lambda (x,y): (x-offset_x, y-offset_y), a)
    roadmap.add(dwg.polyline(points=b,\
                             stroke=route_colour.get(props['highway'], 'black')))

dwg.save()
