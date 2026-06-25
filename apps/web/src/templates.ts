import { DEFAULT_SCHEMA_TYPES } from './schema'
import { DEFAULT_RELATIONSHIP_TYPES } from './relationshipSchema'
import { DEFAULT_CONCEPT_SCHEMAS } from './conceptSchema'
import type { SchemaType } from './schema'
import type { RelationshipType } from './relationshipSchema'
import type { ConceptSchemaType } from './conceptSchema'
import type { AssetData, CanvasImage } from './types'
import type { ProjectGraph } from './projectStore'

export type ProjectTemplate = {
  id: string
  name: string
  description: string
  entitySchema: SchemaType[]
  relSchema: RelationshipType[]
  conceptSchema: ConceptSchemaType[]
  graph: ProjectGraph
  assets?: AssetData[]
  canvasImages?: CanvasImage[]
}

// ── Blank World ─────────────────────────────────────────────────────────

const blankWorld: ProjectTemplate = {
  id: 'template-blank',
  name: 'Blank World',
  description: 'Start from scratch with default schemas. For experienced users.',
  entitySchema: DEFAULT_SCHEMA_TYPES,
  relSchema: DEFAULT_RELATIONSHIP_TYPES,
  conceptSchema: DEFAULT_CONCEPT_SCHEMAS,
  graph: { nodes: [], edges: [] },
}

// ── Story Writing ───────────────────────────────────────────────────────

const storyWriting: ProjectTemplate = {
  id: 'template-story',
  name: 'Story Writing',
  description: 'Characters, Locations, Factions, Themes, Events. Built for novelists and worldbuilders.',
  entitySchema: [
    {
      id: 'schema-character',
      name: 'Character',
      fields: [
        { id: 'f-char-role',       name: 'Role',       description: 'e.g. Protagonist, Antagonist, Mentor' },
        { id: 'f-char-motivation', name: 'Motivation', description: 'What drives this character?' },
        { id: 'f-char-arc',        name: 'Arc',        description: 'How does this character change?' },
        { id: 'f-char-desc',       name: 'Description', description: 'Appearance, personality, background' },
      ],
      conceptSchemaIds: ['concept-technique', 'concept-skill', 'concept-item'],
    },
    {
      id: 'schema-location',
      name: 'Location',
      fields: [
        { id: 'f-loc-region',     name: 'Region',      description: 'Geographic area or kingdom' },
        { id: 'f-loc-government', name: 'Government',  description: 'Who controls this place?' },
        { id: 'f-loc-population', name: 'Population',  description: 'Size and demographics' },
        { id: 'f-loc-desc',       name: 'Description', description: 'Look, feel, atmosphere' },
      ],
    },
    {
      id: 'schema-faction',
      name: 'Faction',
      fields: [
        { id: 'f-fac-leader',   name: 'Leader',      description: 'Who leads this faction?' },
        { id: 'f-fac-goal',     name: 'Goal',        description: 'What does this faction want?' },
        { id: 'f-fac-ideology', name: 'Ideology',    description: 'Core beliefs or principles' },
        { id: 'f-fac-desc',     name: 'Description', description: 'Structure, size, reputation' },
      ],
    },
    {
      id: 'schema-event',
      name: 'Event',
      fields: [
        { id: 'f-event-when',        name: 'When',        description: 'When does this occur?' },
        { id: 'f-event-trigger',     name: 'Trigger',     description: 'What causes this event?' },
        { id: 'f-event-consequence', name: 'Consequence', description: 'What changes after?' },
      ],
    },
    {
      id: 'schema-object',
      name: 'Object',
      fields: [
        { id: 'f-obj-function',     name: 'Function',     description: 'What does this object do?' },
        { id: 'f-obj-origin',       name: 'Origin',       description: 'Where did it come from?' },
        { id: 'f-obj-significance', name: 'Significance', description: 'Why does it matter?' },
      ],
    },
    {
      id: 'schema-theme',
      name: 'Theme',
      fields: [
        { id: 'f-theme-question', name: 'Central Question', description: 'What question does this theme explore?' },
        { id: 'f-theme-examples', name: 'Examples',         description: 'Where does this theme appear?' },
      ],
    },
  ],
  relSchema: [
    { id: 'rel-allies',     name: 'Allies',     description: 'Cooperation or friendship',       defaultColor: '#22c55e' },
    { id: 'rel-opposes',    name: 'Opposes',    description: 'Active conflict or opposition',    defaultColor: '#ef4444' },
    { id: 'rel-mentors',    name: 'Mentors',    description: 'Teaches, guides, or trains',       defaultColor: '#3b82f6' },
    { id: 'rel-betrays',    name: 'Betrays',    description: 'Trust violated or broken',         defaultColor: '#f97316' },
    { id: 'rel-leads',      name: 'Leads',      description: 'Commands or is in charge of',      defaultColor: '#8b5cf6' },
    { id: 'rel-member-of',  name: 'Member Of',  description: 'Belongs to a group or faction',    defaultColor: '#06b6d4' },
    { id: 'rel-located-in', name: 'Located In', description: 'Physically present in a place',    defaultColor: '#64748b' },
  ],
  conceptSchema: [
    {
      id: 'concept-technique',
      name: 'Technique',
      description: 'A combat or skill technique',
      fields: [
        { id: 'f-tech-damage', name: 'Damage',        description: 'Damage dealt' },
        { id: 'f-tech-status', name: 'Status Effect',  description: 'Status condition inflicted' },
        { id: 'f-tech-dice',   name: 'Dice Roll',     description: 'e.g. 1d8+2' },
      ],
    },
    {
      id: 'concept-skill',
      name: 'Skill',
      description: 'A passive or active skill',
      fields: [
        { id: 'f-skill-type',   name: 'Type',        description: 'Active or Passive' },
        { id: 'f-skill-effect', name: 'Effect',       description: 'What it does' },
        { id: 'f-skill-req',    name: 'Requirement',  description: 'What unlocks this skill' },
      ],
    },
    {
      id: 'concept-item',
      name: 'Item',
      description: 'An item or piece of equipment',
      fields: [
        { id: 'f-item-effect',   name: 'Effect',   description: 'What it does' },
        { id: 'f-item-quantity',  name: 'Quantity',  description: 'How many' },
        { id: 'f-item-rarity',   name: 'Rarity',    description: 'e.g. Common, Rare, Legendary' },
      ],
    },
  ],
  graph: {
    rootNodeId: 'story-hero',
    nodes: [
      {
        id: 'story-hero', type: 'circle',
        position: { x: 100, y: 200 },
        data: { label: 'Hero', entityType: 'Character', typeId: 'schema-character', fields: {}, description: '', sizeLevel: 4 },
      },
      {
        id: 'story-villain', type: 'circle',
        position: { x: 500, y: 200 },
        data: { label: 'Villain', entityType: 'Character', typeId: 'schema-character', fields: {}, description: '', sizeLevel: 4 },
      },
      {
        id: 'story-kingdom', type: 'circle',
        position: { x: 100, y: 500 },
        data: { label: 'Kingdom', entityType: 'Location', typeId: 'schema-location', fields: {}, description: '', sizeLevel: 3 },
      },
      {
        id: 'story-dark-faction', type: 'circle',
        position: { x: 500, y: 500 },
        data: { label: 'Dark Faction', entityType: 'Faction', typeId: 'schema-faction', fields: {}, description: '', sizeLevel: 3 },
      },
    ],
    edges: [
      {
        id: 'story-e1', source: 'story-hero', target: 'story-villain', label: 'Opposes',
        type: 'relationship',
        data: { labelT: 0.5, relationshipTypeId: 'rel-opposes', schemaColor: '#ef4444' },
      },
      {
        id: 'story-e2', source: 'story-hero', target: 'story-kingdom', label: 'Located In',
        type: 'relationship',
        data: { labelT: 0.5, relationshipTypeId: 'rel-located-in', schemaColor: '#64748b' },
      },
      {
        id: 'story-e3', source: 'story-villain', target: 'story-dark-faction', label: 'Leads',
        type: 'relationship',
        data: { labelT: 0.5, relationshipTypeId: 'rel-leads', schemaColor: '#8b5cf6' },
      },
    ],
  },
}

// ── D&D Campaign ────────────────────────────────────────────────────────

const dndCampaign: ProjectTemplate = {
  id: 'template-dnd',
  name: 'D&D Campaign',
  description: 'Sessions, Encounters, Quests, NPCs, Dungeons, Monsters. Built for Dungeon Masters.',
  entitySchema: [
    {
      id: 'schema-pc',
      name: 'Player Character',
      fields: [
        { id: 'f-pc-class', name: 'Class',       description: 'e.g. Fighter, Wizard, Rogue' },
        { id: 'f-pc-race',  name: 'Race',        description: 'e.g. Human, Elf, Dwarf' },
        { id: 'f-pc-level', name: 'Level',       description: 'Character level' },
        { id: 'f-pc-bg',    name: 'Background',  description: 'Backstory and motivation' },
      ],
      conceptSchemaIds: ['concept-spell', 'concept-feat', 'concept-skill', 'concept-class-ability', 'concept-magic-item', 'concept-ability'],
    },
    {
      id: 'schema-npc',
      name: 'NPC',
      fields: [
        { id: 'f-npc-role',       name: 'Role',        description: 'e.g. Shopkeeper, Quest Giver, Villain' },
        { id: 'f-npc-motivation', name: 'Motivation',  description: 'What does this NPC want?' },
        { id: 'f-npc-secret',     name: 'Secret',      description: 'Hidden info the players might discover' },
        { id: 'f-npc-desc',       name: 'Description', description: 'Appearance and personality' },
      ],
      conceptSchemaIds: ['concept-spell', 'concept-magic-item', 'concept-ability'],
    },
    {
      id: 'schema-faction',
      name: 'Faction',
      fields: [
        { id: 'f-fac-leader',   name: 'Leader',      description: 'Who leads this faction?' },
        { id: 'f-fac-goal',     name: 'Goal',        description: 'What does this faction want?' },
        { id: 'f-fac-desc',     name: 'Description', description: 'Reputation, size, influence' },
      ],
    },
    {
      id: 'schema-quest',
      name: 'Quest',
      fields: [
        { id: 'f-quest-objective', name: 'Objective', description: 'What must be accomplished?' },
        { id: 'f-quest-reward',    name: 'Reward',    description: 'Gold, items, reputation' },
        { id: 'f-quest-hook',      name: 'Hook',      description: 'How do players learn about this?' },
        { id: 'f-quest-stakes',    name: 'Stakes',    description: 'What happens if they fail?' },
      ],
    },
    {
      id: 'schema-session',
      name: 'Session',
      fields: [
        { id: 'f-sess-summary',  name: 'Summary',        description: 'What happened this session' },
        { id: 'f-sess-goals',    name: 'Goals',          description: 'What the party is trying to accomplish' },
        { id: 'f-sess-npcs',     name: 'Important NPCs', description: 'Key NPCs involved this session' },
        { id: 'f-sess-threads',  name: 'Open Threads',   description: 'Unresolved plot hooks and loose ends' },
      ],
    },
    {
      id: 'schema-encounter',
      name: 'Encounter',
      fields: [
        { id: 'f-enc-difficulty', name: 'Difficulty',  description: 'Easy, Medium, Hard, Deadly' },
        { id: 'f-enc-xp',        name: 'XP Budget',   description: 'Total XP for this encounter' },
        { id: 'f-enc-creatures',  name: 'Creatures',   description: 'What monsters or enemies appear' },
        { id: 'f-enc-terrain',    name: 'Terrain',     description: 'Environmental features and hazards' },
        { id: 'f-enc-objectives', name: 'Objectives',  description: 'Win conditions beyond kill everything' },
        { id: 'f-enc-loot',       name: 'Loot',        description: 'Rewards for completing the encounter' },
      ],
    },
    {
      id: 'schema-location',
      name: 'Location',
      fields: [
        { id: 'f-loc-region',     name: 'Region',      description: 'Geographic area' },
        { id: 'f-loc-features',   name: 'Features',    description: 'Notable landmarks or details' },
        { id: 'f-loc-encounters', name: 'Encounters',  description: 'What might the party face here?' },
      ],
    },
    {
      id: 'schema-dungeon',
      name: 'Dungeon',
      fields: [
        { id: 'f-dun-rooms',   name: 'Rooms',     description: 'Number or notable rooms' },
        { id: 'f-dun-boss',    name: 'Boss',       description: 'Final encounter' },
        { id: 'f-dun-loot',    name: 'Loot',       description: 'Notable treasure' },
        { id: 'f-dun-hazards', name: 'Hazards',    description: 'Traps, puzzles, environmental dangers' },
      ],
    },
    {
      id: 'schema-monster',
      name: 'Monster',
      fields: [
        { id: 'f-mon-cr',         name: 'CR',          description: 'Challenge Rating' },
        { id: 'f-mon-type',       name: 'Type',        description: 'e.g. Undead, Beast, Fiend' },
        { id: 'f-mon-abilities',  name: 'Abilities',   description: 'Special attacks or traits' },
        { id: 'f-mon-weakness',   name: 'Weakness',    description: 'Vulnerabilities' },
      ],
    },
    {
      id: 'schema-item',
      name: 'Item',
      fields: [
        { id: 'f-item-type',     name: 'Type',         description: 'Weapon, Armor, Potion, etc.' },
        { id: 'f-item-rarity',   name: 'Rarity',       description: 'Common, Uncommon, Rare, etc.' },
        { id: 'f-item-property', name: 'Properties',   description: 'Special effects or attunement' },
      ],
    },
  ],
  relSchema: [
    { id: 'rel-quest-giver', name: 'Quest Giver', description: 'Assigns or offers a quest',       defaultColor: '#eab308' },
    { id: 'rel-enemy-of',    name: 'Enemy Of',    description: 'Hostile toward',                   defaultColor: '#ef4444' },
    { id: 'rel-member-of',   name: 'Member Of',   description: 'Belongs to a group or faction',    defaultColor: '#06b6d4' },
    { id: 'rel-located-in',  name: 'Located In',  description: 'Physically present in a place',    defaultColor: '#64748b' },
    { id: 'rel-contains',    name: 'Contains',    description: 'Found inside or part of',          defaultColor: '#78716c' },
    { id: 'rel-part-of',     name: 'Part Of',     description: 'A component or sub-area of',       defaultColor: '#a1a1aa' },
    { id: 'rel-protects',    name: 'Protects',    description: 'Guards or defends',                defaultColor: '#22c55e' },
    { id: 'rel-rules',       name: 'Rules',       description: 'Controls or governs',              defaultColor: '#8b5cf6' },
    { id: 'rel-serves',      name: 'Serves',      description: 'Works for or is loyal to',         defaultColor: '#a855f7' },
    { id: 'rel-owns',        name: 'Owns',        description: 'Possesses or has claim to',        defaultColor: '#14b8a6' },
    { id: 'rel-patrols',     name: 'Patrols',     description: 'Regularly watches or guards',      defaultColor: '#f59e0b' },
    { id: 'rel-hunts',       name: 'Hunts',       description: 'Actively pursuing or tracking',    defaultColor: '#dc2626' },
    { id: 'rel-worships',    name: 'Worships',    description: 'Devoted to or follows',            defaultColor: '#c084fc' },
    { id: 'rel-introduces',  name: 'Introduces',  description: 'First appearance or reveal of',    defaultColor: '#2dd4bf' },
    { id: 'rel-advances',    name: 'Advances',    description: 'Moves forward or progresses',      defaultColor: '#38bdf8' },
  ],
  conceptSchema: [
    {
      id: 'concept-spell',
      name: 'Spell',
      description: 'A magical spell or cantrip',
      fields: [
        { id: 'f-spell-level',    name: 'Level',        description: 'Spell level (0 = cantrip)' },
        { id: 'f-spell-school',   name: 'School',       description: 'e.g. Evocation, Necromancy' },
        { id: 'f-spell-effect',   name: 'Effect',       description: 'What it does' },
        { id: 'f-spell-range',    name: 'Range',        description: 'e.g. Touch, 60 ft, Self' },
        { id: 'f-spell-damage',   name: 'Damage Formula', description: 'e.g. 8d6, 2d10+4' },
        { id: 'f-spell-save',     name: 'Save Type',    description: 'e.g. DEX, WIS, CON' },
        { id: 'f-spell-duration', name: 'Duration',     description: 'Instantaneous, 1 minute, Concentration' },
        { id: 'f-spell-casting',  name: 'Casting Time', description: '1 action, bonus action, ritual' },
      ],
    },
    {
      id: 'concept-ability',
      name: 'Ability',
      description: 'A homebrew or monster ability',
      fields: [
        { id: 'f-abil-damage',   name: 'Damage',        description: 'Damage formula e.g. 3d8+4' },
        { id: 'f-abil-dice',     name: 'Dice Roll',     description: 'Any associated dice roll' },
        { id: 'f-abil-cooldown', name: 'Cooldown',      description: 'e.g. 2 turns, recharge 5-6' },
        { id: 'f-abil-cost',     name: 'Resource Cost',  description: 'Ki, sorcery points, charges' },
        { id: 'f-abil-desc',     name: 'Description',   description: 'What this ability does' },
      ],
    },
    {
      id: 'concept-feat',
      name: 'Feat',
      description: 'A special feat or talent',
      fields: [
        { id: 'f-feat-prereq', name: 'Prerequisite', description: 'Required ability score or level' },
        { id: 'f-feat-effect', name: 'Effect',       description: 'What it grants' },
      ],
    },
    {
      id: 'concept-skill',
      name: 'Skill',
      description: 'A proficiency or expertise',
      fields: [
        { id: 'f-skill-ability', name: 'Ability',     description: 'Linked ability score' },
        { id: 'f-skill-prof',    name: 'Proficiency',  description: 'Proficient or Expert' },
      ],
    },
    {
      id: 'concept-class-ability',
      name: 'Class Ability',
      description: 'A class-specific feature',
      fields: [
        { id: 'f-ca-level',  name: 'Level Gained', description: 'What level this is gained' },
        { id: 'f-ca-effect', name: 'Effect',        description: 'What it does' },
        { id: 'f-ca-uses',   name: 'Uses',          description: 'Per rest or at will' },
      ],
    },
    {
      id: 'concept-magic-item',
      name: 'Magic Item',
      description: 'A magical item or artifact',
      fields: [
        { id: 'f-mi-rarity',    name: 'Rarity',     description: 'Uncommon, Rare, Very Rare, Legendary' },
        { id: 'f-mi-attune',    name: 'Attunement',  description: 'Requires attunement?' },
        { id: 'f-mi-property',  name: 'Properties',  description: 'What it does' },
      ],
    },
  ],
  graph: {
    rootNodeId: 'dnd-quest',
    nodes: [
      {
        id: 'dnd-session', type: 'circle',
        position: { x: -161, y: 158 },
        data: { label: 'Session 1', entityType: 'Session', typeId: 'schema-session', fields: {}, description: '', sizeLevel: 3 },
      },
      {
        id: 'dnd-oakvale', type: 'circle',
        position: { x: 300, y: 100 },
        data: { label: 'Village of Oakvale', entityType: 'Location', typeId: 'schema-location', fields: {}, description: '', sizeLevel: 3 },
      },
      {
        id: 'dnd-mayor', type: 'circle',
        position: { x: 0, y: 350 },
        data: { label: 'Mayor Tarkin', entityType: 'NPC', typeId: 'schema-npc', fields: {}, description: '', sizeLevel: 2 },
      },
      {
        id: 'dnd-quest', type: 'circle',
        position: { x: 156, y: 364 },
        data: { label: 'Missing Children Quest', entityType: 'Quest', typeId: 'schema-quest', fields: {}, description: '', sizeLevel: 4 },
      },
      {
        id: 'dnd-ambush', type: 'circle',
        position: { x: 600, y: 250 },
        data: { label: 'Goblin Ambush', entityType: 'Encounter', typeId: 'schema-encounter', fields: {}, description: '', sizeLevel: 3 },
      },
      {
        id: 'dnd-forest-road', type: 'circle',
        position: { x: 489, y: 91 },
        data: { label: 'Forest Road', entityType: 'Location', typeId: 'schema-location', fields: {}, description: '', sizeLevel: 2 },
      },
      {
        id: 'dnd-goblin-scout', type: 'circle',
        position: { x: 850, y: 250 },
        data: { label: 'Goblin Scout', entityType: 'Monster', typeId: 'schema-monster', fields: {}, description: '', sizeLevel: 2 },
      },
      {
        id: 'dnd-cave', type: 'circle',
        position: { x: 300, y: 600 },
        data: { label: 'Goblin Cave', entityType: 'Dungeon', typeId: 'schema-dungeon', fields: {}, description: '', sizeLevel: 3 },
      },
      {
        id: 'dnd-goblin-chief', type: 'circle',
        position: { x: 600, y: 500 },
        data: { label: 'Goblin Chief', entityType: 'Monster', typeId: 'schema-monster', fields: {}, description: '', sizeLevel: 3 },
      },
    ],
    edges: [
      {
        id: 'dnd-e1', source: 'dnd-session', target: 'dnd-mayor', label: 'Introduces',
        type: 'relationship',
        data: { labelT: 0.658, relationshipTypeId: 'rel-introduces', schemaColor: '#2dd4bf' },
      },
      {
        id: 'dnd-e2', source: 'dnd-session', target: 'dnd-quest', label: 'Advances',
        type: 'relationship',
        data: { labelT: 0.5, relationshipTypeId: 'rel-advances', schemaColor: '#38bdf8' },
      },
      {
        id: 'dnd-e3', source: 'dnd-mayor', target: 'dnd-quest', label: 'Quest Giver',
        type: 'relationship',
        data: { labelT: 0.5, relationshipTypeId: 'rel-quest-giver', schemaColor: '#eab308' },
      },
      {
        id: 'dnd-e4', source: 'dnd-mayor', target: 'dnd-oakvale', label: 'Located In',
        type: 'relationship',
        data: { labelT: 0.5, relationshipTypeId: 'rel-located-in', schemaColor: '#64748b' },
      },
      {
        id: 'dnd-e5', source: 'dnd-ambush', target: 'dnd-goblin-scout', label: 'Contains',
        type: 'relationship',
        data: { labelT: 0.5, relationshipTypeId: 'rel-contains', schemaColor: '#78716c' },
      },
      {
        id: 'dnd-e6', source: 'dnd-ambush', target: 'dnd-forest-road', label: 'Located In',
        type: 'relationship',
        data: { labelT: 0.292, relationshipTypeId: 'rel-located-in', schemaColor: '#64748b' },
      },
      {
        id: 'dnd-e7', source: 'dnd-goblin-chief', target: 'dnd-cave', label: 'Rules',
        type: 'relationship',
        data: { labelT: 0.5, relationshipTypeId: 'rel-rules', schemaColor: '#8b5cf6' },
      },
      {
        id: 'dnd-e8', source: 'dnd-quest', target: 'dnd-cave', label: 'Located In',
        type: 'relationship',
        data: { labelT: 0.662, relationshipTypeId: 'rel-located-in', schemaColor: '#64748b' },
      },
      {
        id: 'dnd-e9', source: 'dnd-goblin-chief', target: 'dnd-goblin-scout', label: 'Rules',
        type: 'relationship',
        data: { labelT: 0.5, relationshipTypeId: 'rel-rules', schemaColor: '#8b5cf6' },
      },
    ],
  },
}

// ── RPG World ───────────────────────────────────────────────────────────

const rpgWorld: ProjectTemplate = {
  id: 'template-rpg',
  name: 'RPG World',
  description: 'Enemies, Bosses, Items, Quests, Dungeons. Built for game designers.',
  entitySchema: [
    {
      id: 'schema-character',
      name: 'Character',
      fields: [
        { id: 'f-char-class', name: 'Class',       description: 'e.g. Warrior, Mage, Healer' },
        { id: 'f-char-hp',    name: 'HP',          description: 'Hit points' },
        { id: 'f-char-desc',  name: 'Description', description: 'Background and personality' },
      ],
      conceptSchemaIds: ['concept-ability', 'concept-skill', 'concept-spell', 'concept-item'],
    },
    {
      id: 'schema-enemy',
      name: 'Enemy',
      fields: [
        { id: 'f-enemy-hp',       name: 'HP',        description: 'Hit points' },
        { id: 'f-enemy-attack',   name: 'Attack',    description: 'Attack pattern or power' },
        { id: 'f-enemy-weakness', name: 'Weakness',  description: 'Elemental or tactical weakness' },
        { id: 'f-enemy-zone',     name: 'Zone',      description: 'Where this enemy appears' },
      ],
      conceptSchemaIds: ['concept-ability', 'concept-status-effect'],
    },
    {
      id: 'schema-boss',
      name: 'Boss',
      fields: [
        { id: 'f-boss-hp',       name: 'HP',        description: 'Hit points' },
        { id: 'f-boss-phases',   name: 'Phases',    description: 'Number of combat phases' },
        { id: 'f-boss-weakness', name: 'Weakness',  description: 'Elemental or tactical weakness' },
        { id: 'f-boss-loot',     name: 'Loot',      description: 'Drops on defeat' },
      ],
      conceptSchemaIds: ['concept-ability', 'concept-status-effect'],
    },
    {
      id: 'schema-quest',
      name: 'Quest',
      fields: [
        { id: 'f-quest-objective', name: 'Objective', description: 'What the player must do' },
        { id: 'f-quest-reward',    name: 'Reward',    description: 'XP, gold, items' },
        { id: 'f-quest-prereq',    name: 'Prerequisite', description: 'Required before this quest' },
      ],
    },
    {
      id: 'schema-town',
      name: 'Town',
      fields: [
        { id: 'f-town-shops',    name: 'Shops',     description: 'Available services' },
        { id: 'f-town-features', name: 'Features',  description: 'Notable landmarks' },
        { id: 'f-town-level',    name: 'Level Range', description: 'Recommended player level' },
      ],
    },
    {
      id: 'schema-dungeon',
      name: 'Dungeon',
      fields: [
        { id: 'f-dun-floors',  name: 'Floors',     description: 'Number of floors' },
        { id: 'f-dun-boss',    name: 'Boss',       description: 'Final boss encounter' },
        { id: 'f-dun-loot',    name: 'Loot',       description: 'Notable treasure' },
        { id: 'f-dun-level',   name: 'Level Range', description: 'Recommended player level' },
      ],
    },
    {
      id: 'schema-item',
      name: 'Item',
      fields: [
        { id: 'f-item-type',   name: 'Type',    description: 'Weapon, Armor, Consumable, etc.' },
        { id: 'f-item-stats',  name: 'Stats',   description: 'ATK, DEF, or effect values' },
        { id: 'f-item-rarity', name: 'Rarity',  description: 'Common, Uncommon, Rare, Epic, Legendary' },
        { id: 'f-item-price',  name: 'Price',   description: 'Buy/sell cost' },
      ],
    },
    {
      id: 'schema-skill',
      name: 'Skill',
      fields: [
        { id: 'f-skill-type',     name: 'Type',       description: 'Active, Passive, or Ultimate' },
        { id: 'f-skill-cost',     name: 'Cost',       description: 'MP, cooldown, or resource cost' },
        { id: 'f-skill-effect',   name: 'Effect',     description: 'What it does' },
        { id: 'f-skill-unlock',   name: 'Unlock',     description: 'How to learn this skill' },
      ],
    },
    {
      id: 'schema-status-effect',
      name: 'Status Effect',
      fields: [
        { id: 'f-status-duration', name: 'Duration',   description: 'Turns or seconds' },
        { id: 'f-status-effect',   name: 'Effect',     description: 'What happens each tick' },
        { id: 'f-status-cure',     name: 'Cure',       description: 'How to remove it' },
      ],
    },
  ],
  relSchema: [
    { id: 'rel-drops',       name: 'Drops',       description: 'Defeated enemy yields this',   defaultColor: '#eab308' },
    { id: 'rel-unlocks',     name: 'Unlocks',     description: 'Completing this grants access', defaultColor: '#22c55e' },
    { id: 'rel-requires',    name: 'Requires',    description: 'Must have before progressing', defaultColor: '#f97316' },
    { id: 'rel-weak-to',     name: 'Weak To',     description: 'Takes extra damage from',     defaultColor: '#ef4444' },
    { id: 'rel-upgrades-to', name: 'Upgrades To', description: 'Evolves or improves into',    defaultColor: '#8b5cf6' },
    { id: 'rel-contains',    name: 'Contains',    description: 'Found inside or part of',     defaultColor: '#64748b' },
  ],
  conceptSchema: [
    {
      id: 'concept-ability',
      name: 'Ability',
      description: 'A special attack or power',
      fields: [
        { id: 'f-abil-damage', name: 'Damage',  description: 'Damage value or formula' },
        { id: 'f-abil-cost',   name: 'Cost',    description: 'MP or resource cost' },
        { id: 'f-abil-type',   name: 'Type',    description: 'Physical, Magical, etc.' },
      ],
    },
    {
      id: 'concept-skill',
      name: 'Skill',
      description: 'A passive or active skill',
      fields: [
        { id: 'f-skill-type',   name: 'Type',   description: 'Active or Passive' },
        { id: 'f-skill-effect', name: 'Effect', description: 'What it does' },
        { id: 'f-skill-req',    name: 'Requirement', description: 'What unlocks this' },
      ],
    },
    {
      id: 'concept-spell',
      name: 'Spell',
      description: 'A magical spell',
      fields: [
        { id: 'f-spell-cost',   name: 'Cost',   description: 'Mana cost' },
        { id: 'f-spell-effect', name: 'Effect', description: 'What it does' },
        { id: 'f-spell-elem',   name: 'Element', description: 'Fire, Ice, Lightning, etc.' },
      ],
    },
    {
      id: 'concept-item',
      name: 'Item',
      description: 'An equippable or consumable item',
      fields: [
        { id: 'f-item-effect',  name: 'Effect',  description: 'What it does' },
        { id: 'f-item-qty',     name: 'Quantity', description: 'Stack size' },
        { id: 'f-item-rarity',  name: 'Rarity',   description: 'Drop rarity' },
      ],
    },
    {
      id: 'concept-status-effect',
      name: 'Status Effect',
      description: 'A buff or debuff',
      fields: [
        { id: 'f-se-duration', name: 'Duration', description: 'How long it lasts' },
        { id: 'f-se-effect',   name: 'Effect',   description: 'What it does each turn' },
        { id: 'f-se-stacks',   name: 'Stacks',   description: 'Can it stack?' },
      ],
    },
  ],
  graph: {
    rootNodeId: 'rpg-quest',
    nodes: [
      {
        id: 'rpg-slime', type: 'circle',
        position: { x: 0, y: 200 },
        data: { label: 'Slime', entityType: 'Enemy', typeId: 'schema-enemy', fields: {}, description: '', sizeLevel: 2 },
      },
      {
        id: 'rpg-potion', type: 'circle',
        position: { x: 250, y: 200 },
        data: { label: 'Potion', entityType: 'Item', typeId: 'schema-item', fields: {}, description: '', sizeLevel: 2 },
      },
      {
        id: 'rpg-quest', type: 'circle',
        position: { x: 500, y: 200 },
        data: { label: 'First Quest', entityType: 'Quest', typeId: 'schema-quest', fields: {}, description: '', sizeLevel: 3 },
      },
      {
        id: 'rpg-dungeon', type: 'circle',
        position: { x: 750, y: 200 },
        data: { label: 'Crystal Cave', entityType: 'Dungeon', typeId: 'schema-dungeon', fields: {}, description: '', sizeLevel: 3 },
      },
      {
        id: 'rpg-boss', type: 'circle',
        position: { x: 1000, y: 200 },
        data: { label: 'Crystal Golem', entityType: 'Boss', typeId: 'schema-boss', fields: {}, description: '', sizeLevel: 4 },
      },
    ],
    edges: [
      {
        id: 'rpg-e1', source: 'rpg-slime', target: 'rpg-potion', label: 'Drops',
        type: 'relationship',
        data: { labelT: 0.5, relationshipTypeId: 'rel-drops', schemaColor: '#eab308' },
      },
      {
        id: 'rpg-e2', source: 'rpg-potion', target: 'rpg-quest', label: 'Requires',
        type: 'relationship',
        data: { labelT: 0.5, relationshipTypeId: 'rel-requires', schemaColor: '#f97316' },
      },
      {
        id: 'rpg-e3', source: 'rpg-quest', target: 'rpg-dungeon', label: 'Unlocks',
        type: 'relationship',
        data: { labelT: 0.5, relationshipTypeId: 'rel-unlocks', schemaColor: '#22c55e' },
      },
      {
        id: 'rpg-e4', source: 'rpg-dungeon', target: 'rpg-boss', label: 'Contains',
        type: 'relationship',
        data: { labelT: 0.5, relationshipTypeId: 'rel-contains', schemaColor: '#64748b' },
      },
    ],
  },
}

// ── All templates ───────────────────────────────────────────────────────

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  blankWorld,
  storyWriting,
  dndCampaign,
  rpgWorld,
]
