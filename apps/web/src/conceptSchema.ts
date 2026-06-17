import type { SchemaField } from './schema'

export type ConceptSchemaType = {
  id: string
  name: string
  description?: string
  fields: SchemaField[]
}

export const DEFAULT_CONCEPT_SCHEMAS: ConceptSchemaType[] = [
  {
    id: 'concept-technique',
    name: 'Technique',
    description: 'A combat or skill technique',
    fields: [
      { id: 'f-tech-damage', name: 'Damage',       description: 'Damage dealt' },
      { id: 'f-tech-status', name: 'Status Effect', description: 'Status condition inflicted' },
      { id: 'f-tech-dice',   name: 'Dice Roll',    description: 'e.g. 1d8+2' },
    ],
  },
  {
    id: 'concept-item',
    name: 'Item',
    description: 'An item or piece of equipment',
    fields: [
      { id: 'f-item-effect',    name: 'Effect',   description: 'What it does' },
      { id: 'f-item-quantity',  name: 'Quantity',  description: 'How many' },
      { id: 'f-item-rarity',    name: 'Rarity',    description: 'e.g. Common, Rare, Legendary' },
    ],
  },
  {
    id: 'concept-spell',
    name: 'Spell',
    description: 'A magical spell or ability',
    fields: [
      { id: 'f-spell-cost',   name: 'Cost',   description: 'Mana or resource cost' },
      { id: 'f-spell-effect', name: 'Effect', description: 'What it does' },
      { id: 'f-spell-range',  name: 'Range',  description: 'e.g. Single, Area, Touch' },
    ],
  },
  {
    id: 'concept-skill',
    name: 'Skill',
    description: 'A passive or active skill',
    fields: [
      { id: 'f-skill-type',   name: 'Type',        description: 'Active or Passive' },
      { id: 'f-skill-effect', name: 'Effect',       description: 'What it does' },
      { id: 'f-skill-req',    name: 'Requirement',  description: 'What unlocks or enables this skill' },
    ],
  },
]
