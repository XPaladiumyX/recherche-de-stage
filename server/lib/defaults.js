export const DEFAULT_TEMPLATES = [
  {
    id: 'stage-dev',
    name: 'Stage — développement / informatique',
    subject: 'Candidature pour un stage en informatique — {{prenom}} {{nom}}',
    body: `Bonjour {{contact}},

Je m'appelle {{prenom}} {{nom}} et je suis en {{formation}} au {{etablissement}}.

Je recherche un stage dans l'informatique et le numérique, de préférence autour de Grenoble. Votre entreprise, {{entreprise}}, implantée à {{ville}}, retient particulièrement mon attention dans le domaine {{famille}}.

Je serais ravi(e) de pouvoir échanger avec vous, de vous présenter ma motivation et de découvrir vos équipes. Vous trouverez ci-joint mon CV et ma lettre de motivation.

Je reste disponible pour un entretien à votre convenance.

Bien cordialement,
{{signature}}`,
  },
  {
    id: 'alternance-dev',
    name: 'Alternance — informatique',
    subject: 'Candidature pour une alternance en informatique — {{prenom}} {{nom}}',
    body: `Bonjour {{contact}},

Je m'appelle {{prenom}} {{nom}} et je suis actuellement en {{formation}} au {{etablissement}}.

Je recherche une alternance dans le numérique et l'informatique. Votre entreprise, {{entreprise}}, située à {{ville}}, m'intéresse pour son activité dans le domaine {{famille}}.

Je souhaite mettre à profit mes compétences et ma motivation au sein de vos équipes. Vous trouverez ci-joint mon CV et ma lettre de motivation.

Je reste à votre disposition pour un entretien ou un échange téléphonique.

Bien cordialement,
{{signature}}`,
  },
  {
    id: 'spontanee-tech',
    name: 'Candidature spontanée — tech',
    subject: 'Candidature spontanée — {{prenom}} {{nom}}',
    body: `Bonjour {{contact}},

Je me permets de vous contacter car je suis à la recherche d'un stage ou d'une alternance dans l'informatique et le numérique.

Votre entreprise, {{entreprise}}, basée à {{ville}}, travaille dans le domaine {{famille}} et je serais très intéressé(e) par la possibilité de rejoindre vos équipes.

Vous trouverez ci-joint mon CV et ma lettre de motivation. N'hésitez pas à me contacter si vous souhaitez davantage d'informations.

Bien cordialement,
{{signature}}`,
  },
  {
    id: 'relance',
    name: 'Relance après candidature',
    subject: 'Relance — candidature stage/alternance — {{prenom}} {{nom}}',
    body: `Bonjour {{contact}},

Je me permets de revenir vers vous concernant ma candidature pour un stage ou une alternance au sein de {{entreprise}}.

Je reste très motivé(e) par cette opportunité et je serais ravi(e) d'échanger avec vous pour vous présenter ma motivation.

Je vous remercie par avance pour votre retour.

Bien cordialement,
{{signature}}`,
  },
];

export const DEFAULT_CONFIG = {
  sender: {
    prenom: '',
    nom: '',
    formation: '',
    etablissement: 'Lycée Vaucanson, Grenoble',
    telephone: '',
    email: '',
    linkedin: '',
    signature: '',
  },
  settings: {
    maxPerDay: 40,
    delayMinSeconds: 45,
    delayMaxSeconds: 90,
    replyTo: '',
  },
};
