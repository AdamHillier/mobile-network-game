import argparse
parser = argparse.ArgumentParser()
parser.add_argument("--latitude", type=float, required=True, help="The latitude of your bounding box center")
parser.add_argument("--longitude", type=float, required=True, help="The longitude of your bounding box center")
args = parser.parse_args()

dlat = 0.005
dlon = 0.02 # double it from 0.01

n = args.latitude + (dlat/2)
s = args.latitude - (dlat/2)
e = args.longitude + (dlon/2)
w = args.longitude - (dlon/2)

query = """<query type="way">
  <bbox-query s="${south}" w="${west}" n="${north}" e="${east}"/>
  <has-kv k="highway" regv="."/>
  <has-kv k="access" modv="not" regv="no"/>
  <has-kv k="access" modv="not" regv="private"/>
  <has-kv k="area" modv="not" regv="yes"/>
</query>
<union>
  <item/>
  <recurse type="down"/>
</union>
<print/>"""

from string import Template
t = Template(query)
interpolated = t.substitute(north=str(n), south=str(s), east=str(e), west=str(w))
print interpolated
