import type { Player } from "../types.js";

/**
 * Seed roster of well-known players with representative per-game averages.
 * Numbers are illustrative and used to demonstrate the fantasy scoring model.
 */
export const SEED_PLAYERS: readonly Player[] = [
  {
    id: "jokic",
    name: "Nikola Jokić",
    team: "DEN",
    position: "C",
    stats: { ppg: 26.4, rpg: 12.4, apg: 9.0, spg: 1.4, bpg: 0.9, topg: 3.0 },
  },
  {
    id: "doncic",
    name: "Luka Dončić",
    team: "DAL",
    position: "PG",
    stats: { ppg: 33.9, rpg: 9.2, apg: 9.8, spg: 1.4, bpg: 0.5, topg: 4.0 },
  },
  {
    id: "giannis",
    name: "Giannis Antetokounmpo",
    team: "MIL",
    position: "PF",
    stats: { ppg: 30.4, rpg: 11.5, apg: 6.5, spg: 1.2, bpg: 1.1, topg: 3.4 },
  },
  {
    id: "sga",
    name: "Shai Gilgeous-Alexander",
    team: "OKC",
    position: "SG",
    stats: { ppg: 30.1, rpg: 5.5, apg: 6.2, spg: 2.0, bpg: 0.9, topg: 2.2 },
  },
  {
    id: "tatum",
    name: "Jayson Tatum",
    team: "BOS",
    position: "SF",
    stats: { ppg: 26.9, rpg: 8.1, apg: 4.9, spg: 1.0, bpg: 0.6, topg: 2.5 },
  },
  {
    id: "wembanyama",
    name: "Victor Wembanyama",
    team: "SAS",
    position: "C",
    stats: { ppg: 21.4, rpg: 10.6, apg: 3.9, spg: 1.2, bpg: 3.6, topg: 3.7 },
  },
  {
    id: "edwards",
    name: "Anthony Edwards",
    team: "MIN",
    position: "SG",
    stats: { ppg: 25.9, rpg: 5.4, apg: 5.1, spg: 1.3, bpg: 0.5, topg: 3.1 },
  },
  {
    id: "haliburton",
    name: "Tyrese Haliburton",
    team: "IND",
    position: "PG",
    stats: { ppg: 20.1, rpg: 3.9, apg: 10.9, spg: 1.2, bpg: 0.7, topg: 2.3 },
  },
  {
    id: "durant",
    name: "Kevin Durant",
    team: "PHX",
    position: "SF",
    stats: { ppg: 27.1, rpg: 6.6, apg: 5.0, spg: 0.9, bpg: 1.2, topg: 3.3 },
  },
  {
    id: "davis",
    name: "Anthony Davis",
    team: "LAL",
    position: "PF",
    stats: { ppg: 24.7, rpg: 12.6, apg: 3.5, spg: 1.2, bpg: 2.3, topg: 2.1 },
  },
  {
    id: "brunson",
    name: "Jalen Brunson",
    team: "NYK",
    position: "PG",
    stats: { ppg: 28.7, rpg: 3.6, apg: 6.7, spg: 0.9, bpg: 0.2, topg: 2.4 },
  },
  {
    id: "mitchell",
    name: "Donovan Mitchell",
    team: "CLE",
    position: "SG",
    stats: { ppg: 26.6, rpg: 5.1, apg: 6.1, spg: 1.3, bpg: 0.5, topg: 2.8 },
  },
  {
    id: "george",
    name: "Paul George",
    team: "PHI",
    position: "SF",
    stats: { ppg: 22.6, rpg: 5.2, apg: 3.5, spg: 1.5, bpg: 0.5, topg: 2.5 },
  },
  {
    id: "sabonis",
    name: "Domantas Sabonis",
    team: "SAC",
    position: "PF",
    stats: { ppg: 19.4, rpg: 13.7, apg: 8.2, spg: 0.9, bpg: 0.6, topg: 3.2 },
  },
  {
    id: "gobert",
    name: "Rudy Gobert",
    team: "MIN",
    position: "C",
    stats: { ppg: 14.0, rpg: 12.9, apg: 1.2, spg: 0.7, bpg: 2.1, topg: 1.5 },
  },
  {
    id: "fox",
    name: "De'Aaron Fox",
    team: "SAC",
    position: "PG",
    stats: { ppg: 26.6, rpg: 4.6, apg: 5.6, spg: 2.0, bpg: 0.4, topg: 2.6 },
  },
];
