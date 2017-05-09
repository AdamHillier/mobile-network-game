Installation
============

Install Node.js, NPM, and Redis (for the backend).

Run redis-server locally on the default port. If you wish to host Redis elsewhere, set the environment variable REDIS_URL appropriately.

Run `npm install` to install dependencies.

Run `node server` to run on localhost::8080. To run on a different port, set the PORT environment variable appropriately.

Using the data
==============

At the end of the game users can choose to submit their email address and score. These data are stored in Redis; specifically, email addresses are stored in a Redis sorted-set datastructure, keyed by the corresponding score. If a user submits a score and gives an email address that already has a score associated with it, then the old score is updated with the new score only if the new score is strictly greater. 

This makes it easy, for example, to retrieve the top N scoring email addresses (along with their corresponding scores): in the Redis cli, run the command `ZREVRANGE scores 0 N-1 WITHSCORES`.
