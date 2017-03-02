use warnings; use strict; use JSON; use SVG;

# usage:
#   perl get_graph.pl <export.osm >test.svg
# Then copy test.svg and adj_graph.json where apache2 can find:
#   sudo cp myfile /var/www/html/

# EXTRACT DATA
# OSM query params: result of postcode conversion (OX1 3BW)
my $lat="51.7541373";
my $lon="-1.25370010000006";

# Read from export.osm: the result of overpass-turbo.eu query
# extract nodes and line segments of the original
my %nodes; # hash of nodes: node id to (lat,lon)
my @edges; # array of ways, ie. array of array of node ids
my $nEdge = 0; # index into @edges

while (<>) {
  # Add a node
  if (/<node id="(\d+)" lat="(-?\d+\.\d+)" lon="(-?\d+\.\d+)"/) {
    $nodes{$1} = [int((($3-$lon)*4*10**4)+200), int((($lat-$2)*4*10**4)+200)];
    # need some numerics to float cast
  } elsif (/<way id="(\d+)">/) {
    # Add a way (line segment)
    while (<>) {
      if (/<nd ref="(\d+)"\/>/) {
        push (@{ $edges[$nEdge] }, $1);
      } elsif (/<\/way>/) {
        $nEdge++;
        last;
      }
    }
  }
}

# RENUMBERING
# renumber nodes with natural numbers
my %node_renumbering;
my @nodes_norm;
my $nNode = 0; # index into @nodes_norm

keys %nodes; # reset iterator so a prior each() doesn't affect the loop:
while (my ($nodeId, $latlon_ref) = each %nodes) {
  $node_renumbering{$nodeId} = $nNode; $nNode++;
  push (@nodes_norm, $latlon_ref);
}

# make the way segments consistent with the node renumbering
my @edges_norm;
for my $way (@edges) {
  push (@edges_norm, [ map { $node_renumbering{$_} } @{ $way } ]);
} # [, ] around map are required (creates reference to anon array)

# Convert a list of coordinates in @nodes_norm,
#   and a list of list of nodes in @edges_norm
# into an adjacency graph
my @neighbours;
for my $way (@edges_norm) {
  my $node_count = scalar @{ $way };
  next if ($node_count == 1);
  my $last_index = $#{ $way };
  while (my ($i, $nodeId) = each @{ $way }) {
    if ($i == 0) {
      # first node in the segment has only one neighbour
      push (@{ $neighbours[$nodeId] }, $way->[1]);
    } elsif ($i == $last_index) {
      # last node in the segment has only one neighbour
      push (@{ $neighbours[$nodeId] }, $way->[$last_index - 1]);
    } else {
      # all the other nodes have two neighbours
      push (@{ $neighbours[$nodeId] }, $way->[$i-1], $way->[$i+1]);
    }
  }
}


## GENERATE JSON OF MAP DATA

# combine nodes/edges into a single hash
my %graph;
$graph{"osm_nodes"} = \@nodes_norm;

# Replacing @edges_norm, which was [[nodeId, nodeId, ...]] of polylines
#  with [[adjacent nodes]]
#$graph{"osm_edges"} = \@edges_norm;
$graph{"osm_adjacency"} = \@neighbours;

# use library function
my $to_json = encode_json (\%graph);

# write to file
my $outfile = 'adj_graph.json';
open(GRAPH, ">$outfile") or die;
print GRAPH $to_json;
close(GRAPH);



## DRAW SVG OF MAP DATA

# NB:
# Here we have to convert integer coordinates into strings
# to comply with the svg library api
# however I think that after this code executes,
# perl believes @nodes_norm consists of strings,
# and the json generation reflects that
# ie. {"osm_nodes":["3","4"]} instead of {"osm_nodes":[3,4]}
# I may have resolved this by just putting the svg generation
# *after* the json generation, though the two are logically independent.

my $static_map = SVG->new( width => 1000, height => 1000 );

## Using method polyline (basically a path)
#  One way becomes one polyline

## From the CPAN docs:
## $tag = $svg->polyline(%attributes)
##   * n-point polyline
##   * points defined by string of the form 'x1,y1,x2,y2, ... xn,yn'.

my $pline_index = 0;
for my $way (@edges_norm) {
  my $node_count = scalar @{ $way };
  next if ($node_count == 1);
  
  # Convert a nodeID into a coord string, eg. "-51.6,1.2"
  my @coord_pairs = map {join(',', @{ $nodes_norm[$_]})} @{ $way };

  # Join the coords to make a polyline
  my $formatted_coords = join(',', @coord_pairs);

  # $line_info is a hashref, containing the coord string with other params
  my $line_info = {
    points => $formatted_coords,
    -type =>'path',
  };
  
  # Draw this polyline
  $static_map->polyline (
    %{ $line_info },
    id=>"pline_$pline_index",
    style=>{
      'fill-opacity'=>0,
      'stroke'=>'black',
    }
  );

  $pline_index++;
}
print $static_map->xmlify;


## Dumping ground for old code:

=begin comment
my @edge_pairs;
for my $way (@edges_norm) {
  my $node_count = scalar @{ $way };
  next if ($node_count == 1);
  for my $i (0 .. $#{ $way }-1) {
    push (@edge_pairs, [$way->[$i], $way->[$i+1]]);
  }
}
    # Trial and error:
    #   int does rounding
    #   center at the origin of the query
    #   offset so all numbers are (probably) positive
    #   large scale up by a power of 10
    #   small scale up
=cut
