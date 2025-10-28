# NBABrain

Ideas:
1. ELO engine: compute score for each team, updated throughout the season, that ranks them based on their performance. Goal is to have a functional ranking system that clearly and accurately identifies who the best teams are at any point throughout the season. We need to determine a fair and optimal way to assess our scores to see how accurate they are.
    - have sparklines for each team showing how elo has moved throughout the season
    - make interactive plot allowing us to add teams to it, showing their elo lines next to each other over time
    - make option to show recent performance of teams today, this week, this month, or the entire season. e.g., OKC thunder ELO dropped by 3 pts this week because they lost to the Houston rockets. 
    - incorporate different factors into ELO score calculation. e.g., team A losing to team B should be interpreted differently if they are on the road, missing their top player(s), playing back-to-back, etc. 
    - show information on when teams lost to underdogs, beat teams as the underdog, how often it happens, etc. Give insight into the strengths and weaknesses of each team and what types of teams they struggle against based on their stats, both simple and complex (e.g., team A struggles against teams that get lots of offensive rebounds, team B struggles against teams with many shooters on their roster, team C does well against teams that have a slow pace, etc.)
2. Player tab: show clear stats for each player, both simple stats (like ppg) and more complex stats (either already existing or ones we create). Group players into position-based taxonomies (like 3&D big, slashing forward, etc.). Compute a 1-99 rating for each player that is aware of their position and weights different skills/stats (e.g., assists are more important for PG than centers). Goal is to accurately identify the best players in the league based on their stats. 
    - perhaps provide shot map if that data is available
3. Matchups tab: show upcoming team matchups, comparing their ELOs and projected winner based on their ELO scores (perhaps compare to vegas odds if possible). 
    - Show current playoff brackets and run simulation using current team data to predict the winner if the playoffs were to start today. Remember to account for injuries
4. Overall visuals: make the project interactive and visually appealing. Animations should appear when switching tabs, changing filters, etc.
    - feel free to use AI and other existing tools to help with this rather than doing everything from scratch