#!/bin/bash

# Loop through the last 150 days (approx 5 months)
for i in {150..0}; do
  
  # Determine the day of the week (1 = Monday, ..., 6 = Saturday, 7 = Sunday)
  # This lets us slightly alter weekend behavior if wanted, or keep it uniformly active.
  DAY_OF_WEEK=$(date -d "$i days ago" +%u)
  
  # Randomly pick an intensity tier for any given day:
  # Tier 0: Low activity (1-2 commits - light green)
  # Tier 1: Moderate activity (3-5 commits - medium-light green)
  # Tier 2: Busy coding day (6-9 commits - medium-dark green)
  # Tier 3: Intense coding spree (10-15 commits - deep dark green)
  # Tier 4: Occasional day off (0 commits)
  
  TIER=$((RANDOM % 5))
  NUM_COMMITS=0
  
  if [ $TIER -eq 0 ]; then
    NUM_COMMITS=$(( (RANDOM % 2) + 1 ))        # 1 to 2
  elif [ $TIER -eq 1 ]; then
    NUM_COMMITS=$(( (RANDOM % 3) + 3 ))        # 3 to 5
  elif [ $TIER -eq 2 ]; then
    NUM_COMMITS=$(( (RANDOM % 4) + 6 ))        # 6 to 9
  elif [ $TIER -eq 3 ]; then
    NUM_COMMITS=$(( (RANDOM % 6) + 10 ))       # 10 to 15 (Dark green blocks)
  elif [ $TIER -eq 4 ]; then
    # Weekend or rest days can still occasionally have light work, 
    # but let's give weekends a 50% chance to drop to 0 or stay low
    if [ $DAY_OF_WEEK -ge 6 ]; then
      NUM_COMMITS=$((RANDOM % 3))             # 0 to 2 on weekends
    else
      NUM_COMMITS=0                           # Rest day mid-week
    fi
  fi
  
  if [ $NUM_COMMITS -gt 0 ]; then
    echo "Creating $NUM_COMMITS commit(s) for $i days ago..."
    
    for ((j=1; j<=NUM_COMMITS; j++)); do
      # Spread timestamps across waking hours (random seconds up to 86400)
      RAND_OFFSET=$((RANDOM % 86400))
      
      # Linux date syntax
      EXACT_DATE=$(date -d "$i days ago + $RAND_OFFSET seconds" +"%Y-%m-%d %H:%M:%S")
      
      # (Mac users: swap the line above with: EXACT_DATE=$(date -v-${i}d +"%Y-%m-%d %H:%M:%S"))
      
      # Write update to log file
      echo "Activity log entry: $EXACT_DATE - patch $j" >> activity_log.txt
      git add activity_log.txt
      
      # Backdated commit
      GIT_AUTHOR_DATE="$EXACT_DATE" GIT_COMMITTER_DATE="$EXACT_DATE" git commit -m "feat: incremental update for module ($j)"
    done
  fi
done

echo "History generation with weekend activity complete!"