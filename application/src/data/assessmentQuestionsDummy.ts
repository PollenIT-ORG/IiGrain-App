import type { AssessmentQuestion, EvidenceFile } from '../types/assessment';

const sampleEvidence: EvidenceFile[] = [
  {
    id: 'ev-meadow',
    uri: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400',
    name: 'flowering-strip.jpg',
    type: 'image',
    sizeLabel: '1.8 MB',
    state: 'uploaded',
  },
  {
    id: 'ev-birdbox',
    uri: 'https://images.unsplash.com/photo-1518715308788-300e1e1f5347?w=400',
    name: 'bird-box.jpg',
    type: 'image',
    sizeLabel: '2.1 MB',
    state: 'uploaded',
  },
  {
    id: 'ev-report',
    uri: '',
    name: 'habitat-survey.pdf',
    type: 'pdf',
    sizeLabel: '640 KB',
    state: 'uploaded',
  },
];

const buildQuestions = (
  categoryId: string,
  prefix: string,
  completed: number,
  specs: { title: string; description: string }[],
): AssessmentQuestion[] =>
  specs.map((spec, i) => {
    const index = i + 1;
    const isCompleted = i < completed;
    const isInProgress = !isCompleted && i === completed;
    return {
      id: `${categoryId}-q${index}`,
      categoryId,
      index,
      code: `${prefix}${index}`,
      title: spec.title,
      description: spec.description,
      score: isCompleted ? 3 : isInProgress ? 2 : null,
      comment: isCompleted
        ? 'Practices in place and documented during the last field visit.'
        : '',
      attachments: isCompleted ? [sampleEvidence[0]] : [],
      status: isCompleted ? 'COMPLETED' : isInProgress ? 'IN_PROGRESS' : 'NOT_STARTED',
      lastUpdatedISO: isCompleted || isInProgress ? '2024-04-20T10:30:00.000Z' : null,
    };
  });

export const assessmentQuestions: Record<string, AssessmentQuestion[]> = {
  'cat-soil': buildQuestions('cat-soil', 's', 5, [
    { title: 'Soil cover', description: 'Living roots / residue keep soil covered year-round' },
    { title: 'Tillage intensity', description: 'Frequency and depth of soil disturbance' },
    { title: 'Organic amendments', description: 'Compost, manure or cover-crop biomass returned to soil' },
    { title: 'Soil testing', description: 'Regular lab tests guide nutrient decisions' },
    { title: 'Compaction management', description: 'Traffic control and decompaction practices' },
    { title: 'Biological activity', description: 'Earthworm counts and microbial indicators tracked' },
  ]),

  'cat-water': buildQuestions('cat-water', 'w', 3, [
    { title: 'Irrigation efficiency', description: 'Scheduling and delivery minimise water loss' },
    { title: 'Drainage management', description: 'Runoff and erosion are controlled at field edges' },
    { title: 'Water quality', description: 'Inputs near waterways are buffered and monitored' },
    { title: 'Rainwater capture', description: 'Ponds / swales retain water on the landscape' },
  ]),

  'cat-bio': [
    ...buildQuestions('cat-bio', 'b', 3, [
      { title: 'Hedgerows & margins', description: 'Field margins host diverse perennial vegetation' },
      { title: 'Pollinator support', description: 'Flowering resources available across the season' },
      { title: 'Crop diversity', description: 'Rotations and intercrops increase plant diversity' },
    ]),
    {
      id: 'cat-bio-q4',
      categoryId: 'cat-bio',
      index: 4,
      code: 'b4',
      title: 'Pest predator habitat',
      description: 'Shelter/food for beneficial insects, raptors, reptiles',
      score: 2,
      comment: 'Planted flowering strips and installed 10 bird boxes along the hedgerows.',
      attachments: sampleEvidence,
      status: 'COMPLETED',
      lastUpdatedISO: '2024-04-20T10:30:00.000Z',
    },
    {
      id: 'cat-bio-q5',
      categoryId: 'cat-bio',
      index: 5,
      code: 'b5',
      title: 'Invasive species control',
      description: 'Monitoring and management of invasive plants/animals',
      score: 2,
      comment: '',
      attachments: [],
      status: 'IN_PROGRESS',
      lastUpdatedISO: '2024-04-18T09:00:00.000Z',
    },
    {
      id: 'cat-bio-q6',
      categoryId: 'cat-bio',
      index: 6,
      code: 'b6',
      title: 'Aquatic habitat',
      description: 'Ponds, ditches and riparian zones support wildlife',
      score: null,
      comment: '',
      attachments: [],
      status: 'NOT_STARTED',
      lastUpdatedISO: null,
    },
  ],

  'cat-carbon': buildQuestions('cat-carbon', 'c', 3, [
    { title: 'Cover cropping', description: 'Cover crops capture carbon and recycle nutrients' },
    { title: 'Nutrient budgeting', description: 'Inputs matched to crop removal to avoid surplus' },
    { title: 'Perennial integration', description: 'Perennials store carbon in roots and biomass' },
    { title: 'Synthetic input reduction', description: 'Reduced reliance on synthetic fertiliser' },
    { title: 'Residue management', description: 'Crop residues retained to build soil carbon' },
  ]),

  'cat-livestock': buildQuestions('cat-livestock', 'l', 3, [
    { title: 'Managed grazing', description: 'Rotational grazing improves pasture recovery' },
    { title: 'Animal welfare', description: 'Stocking density and shelter support welfare' },
    { title: 'Manure cycling', description: 'Manure distributed to fertilise pasture and crops' },
    { title: 'Crop–livestock integration', description: 'Animals graze cover crops / residues' },
  ]),

  'cat-farm': buildQuestions('cat-farm', 'm', 0, [
    { title: 'Record keeping', description: 'Field activities are logged and reviewed' },
    { title: 'Goal setting', description: 'Regenerative goals are defined and tracked' },
    { title: 'Continuous learning', description: 'Training and knowledge-sharing are ongoing' },
    { title: 'Financial resilience', description: 'Diversified income and risk management' },
    { title: 'Input sourcing', description: 'Inputs sourced responsibly and locally where possible' },
    { title: 'Community engagement', description: 'Participation in local regenerative networks' },
  ]),
};
