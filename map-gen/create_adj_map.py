# From a hand traced map (eg. Inkscape etc.), create the abstract adjacency map that the sprites use to navigate
# For now, start the python interpreter with `python` and test with `execfile("create_adj_map.py")`

# Import the svg and extract the paths
# Change the file name from "firstpath.svg" if required
from xml.dom import minidom
doc = minidom.parse("firstpath.svg")
path_strings = [path.getAttribute('d') for path in doc.getElementsByTagName('path')]

# Round the string representation of the coordinates to integers, and make everything a tuple
paths = [map(lambda coord: tuple([int(float(c)) for c in coord.split(',')]), path.split()[1:]) for path in path_strings]

# The svg path element has a string representation of the line's start point, then it's relative displacements from that point
# we need to work with absolute positions, so apply (+start_pos) to all but the first coordinate in the path
def offset_displacement(p0, p1):
  return (p0[0]+p1[0], p0[1]+p1[1])

absolute_paths = []
for path in paths:
  start = path[0]
  offset = map(lambda p: offset_displacement(start, p), path[1:])
  offset.insert(0, start)
  absolute_paths.append(offset)

# We need to elimate "duplicates" in the road map, but because the tracing is imperfect, two points designed to be at the same intersection will be some way apart numerically

threshold = 500
def do_merge(p0, p1):
  dist_squared = (p0[0] - p1[0])**2 + (p0[1] - p1[1])**2
  return (dist_squared < threshold)

class ClosestDict(dict):
  def getClosest(self, point):
    matches = filter(lambda k: do_merge(k,point), self.iterkeys())
    return (matches[0] if (len(matches)>0) else None)

duplicates = ClosestDict()
for path in absolute_paths:
  for point in path:
    entry = duplicates.getClosest(point)
    if (entry):
      duplicates.get(entry).append(point)
    else:
      duplicates[point] = [point]

# Invert the dictionary, so that instead of having one point mapping to all it's duplicates, have every point map to the "true" value
to_canonical = {point: canonical for canonical,aliases in duplicates.iteritems() for point in aliases}

# Build the adjacency list: a list of lists, indexed by node number, and containing a list of neighbours (by their node numbers)
# Node numbers are indicies into a separate list containing the coordinates

import networkx as nx
G = nx.Graph()
for path in absolute_paths:
  for u, v in zip(path, path[1:]):
    G.add_edge(to_canonical[u], to_canonical[v])

def rescale(x, y):
  # todo
  return (x, y)

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

#with open('testing_adj_graph.json', 'w') as fh:
#  fh.write(json.dumps(wrapped, separators=(',', ':')))

