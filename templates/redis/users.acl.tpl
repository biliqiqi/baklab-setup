user default +@all ~* on >$REDISCLI_AUTH
user $REDIS_USER +@read +@write +@list +@hash +@set +@string +@bitmap +@hyperloglog +@geo +@stream +@connection -@admin -@dangerous on >$REDIS_PASSWORD