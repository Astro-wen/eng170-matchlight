export const DATA_COVERAGE = [
 {sport:'gymnastics',providers:['ESPN Olympic results','Paris 2024 archive'],records:'Paris 2024 final/medal results; available competitor names and countries',currentEventFeed:false},
 {sport:'swimming',providers:['ESPN Olympic results','World Aquatics','Paris 2024 archive'],records:'Paris 2024 Olympic results plus date-based official aquatic event lookups; available results and splits',currentEventFeed:true},
 {sport:'athletics',providers:['ESPN Olympic results','Paris 2024 archive'],records:'Paris 2024 Olympic final/medal results; no universal current meet feed',currentEventFeed:false},
 {sport:'diving',providers:['ESPN Olympic results','World Aquatics','Paris 2024 archive'],records:'Olympic results and date-based official lookups; individual dive awards/difficulty when supplied',currentEventFeed:true},
 {sport:'cricket',providers:['ESPN league scoreboards','ESPN current cricket header'],records:'IPL date queries and available current competitions, scorecards and recent commentary',currentEventFeed:true},
] as const;
