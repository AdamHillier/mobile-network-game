# From a hand traced map (eg. Inkscape etc.), create the abstract adjacency map that the sprites use to navigate
#  to run in the interpreter: `execfile("create_adj_map.py")`
import argparse

# Handle command line arguments
parser = argparse.ArgumentParser()
parser.add_argument('infile',
  help="specify a 450px by 450px svg with some paths in it")
args = parser.parse_args()

# Import the svg and extract the paths
from xml.dom import minidom
doc = minidom.parse(args.infile)

# Doesn't work yet, but refine to accept the name of the lines layer
# That way the logical map and the background image can be edited in the same file
path_strings = [path.getAttribute('d') for path in doc.getElementsByTagName('path')]
#path_strings = [path.getAttribute("d") for path in group.getElementsByTagName("path") for group in doc.getElementsByTagName("g") if (group.getAttribute("inkscape:label")==u'lines')]

# Round the string representation of the coordinates to integers
paths = [map(lambda coord: tuple([int(float(c)) for c in coord.split(',')]), path.split()[1:]) for path in path_strings]

print "Paths before formatting:"
print paths

# The path data attribute is prefixed by a capital M for absolute paths,
#   and a lower case m for relative paths
is_relative_path = map(lambda path: path.split()[0]==u'm', path_strings)

def offset_displacement(p0, p1):
  return (p0[0]+p1[0], p0[1]+p1[1])

absolute_paths = []
for path,is_relative in zip(paths, is_relative_path):
  if (is_relative):
    pen_position = path[0]
    abs_path = [pen_position]
    for delta in path[1:]:
      pen_position = offset_displacement(pen_position, delta)
      abs_path.append(pen_position)
    absolute_paths.append(abs_path)
  else:
    absolute_paths.append(path)

print "Paths after formatting:"
print absolute_paths

# We need to elimate "duplicates" in the road map, but because the tracing is imperfect, two points designed to be at the same intersection will be some way apart numerically

import math
threshold = 10
def do_merge(p0, p1):
  d = math.sqrt((p0[0] - p1[0])**2 + (p0[1] - p1[1])**2)
  print d
  return (d < threshold)

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

print "Duplicates dictionary:"
print duplicates

# Invert the dictionary, so that instead of having one point mapping to all it's duplicates, have every point map to the "true" value
to_canonical = {point: canonical for canonical,aliases in duplicates.iteritems() for point in aliases}

print "Inverse duplicates dictionary:"
print to_canonical

# Build the adjacency list: a list of lists, indexed by node number, and containing a list of neighbours (by their node numbers)
# Node numbers are indicies into a separate list containing the coordinates

import networkx as nx
G = nx.Graph()
for path in absolute_paths:
  for u, v in zip(path, path[1:]):
    print "adding edge between "+str(u)+" and "+str(v)
    G.add_edge(to_canonical[u], to_canonical[v])

print "Graph G"
print G.nodes()
print G.adjacency_list()

def rescale(x, y):
  # Might not be necessary
  return (x, y)

# renumber the nodes from 0
coord_to_node = dict((v, i) for i, v in enumerate(G.nodes()))
adj_list = list(list(coord_to_node[c] for c in adj) for adj in G.adjacency_list())
rescaled_nodes = map(lambda coord: rescale(*coord), G.nodes())

# Produce the adjacency graph for game.js
wrapped = {}
wrapped['osm_adjacency'] = adj_list
wrapped['osm_nodes'] = rescaled_nodes

import json
with open('../public/adj_graph.js', 'w') as fh:
  fh.write("ADJ_GRAPH=")
  fh.write(json.dumps(wrapped, separators=(',', ':')))

