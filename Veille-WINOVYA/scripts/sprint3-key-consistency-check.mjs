import { generateCorrelationKey, normalizeForCorrelation } from '../src/lib/opportunities/engine/CorrelationEngine.ts'
console.log(JSON.stringify(generateCorrelationKey({
  entrepriseId: '11111111-1111-1111-1111-111111111111',
  alerteId: '00000000-0000-0000-0000-000000000001',
  entiteCible: 'MBDA',
  typeOpportunite: 'Nouvelle usine',
  geographie: 'Bourges',
})))
console.log(normalizeForCorrelation('Île-de-France'))
console.log(normalizeForCorrelation('Nouvelle usine'))
console.log(normalizeForCorrelation("L'Haÿ-les-Roses"))
console.log(normalizeForCorrelation('Neuilly-sur-Seine'))
console.log(normalizeForCorrelation("Provence-Alpes-Côte d'Azur"))
console.log(JSON.stringify(generateCorrelationKey({
  entrepriseId: '11111111-1111-1111-1111-111111111111',
  alerteId: '00000000-0000-0000-0000-000000000005',
  entiteCible: null,
  typeOpportunite: 'Nouvelle usine',
  geographie: 'Bourges',
})))
