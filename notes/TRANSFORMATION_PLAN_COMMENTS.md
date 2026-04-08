## 1. Activity Categories and metadata
* Film: poster_url -> image_url?
* I would like that image_url is possible for all, and that it is possible to search for an image from the internet to use.
* There should be an optional field for url linking to more information. If a Board/card games or Play activities it could be rules. If Creative activities, it could be description of the activity. If Film, it could be a link to the film, if not found on TMDB.
  
# 2.2
* Yes, flat table

# 2.4
* `rewatch_cooldown_months` should only apply to Films category, but `redo_requests` should still be available for all categories. 

# Other things:
* There should be a way to register a past activity that were not registered.
* For Film and Board/card games, it should be possible to register a new activity with linking to a film or item in the TMDB API or BoardGameGeek XML
* There should be a category filter on every page with a list
* Migration is not important, as system i not in production yet. Let's clean up all the database migration files.