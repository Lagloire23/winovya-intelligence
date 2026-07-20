# WINOVYA — P11.1
## Conception du moteur de raisonnement métier et de corrélation

Document complémentaire au P11.0 (non modifié). Ne traite ni l'écran, ni
les tables, ni les API, ni les migrations, ni l'implémentation. Ne décrit
que le raisonnement métier : comment des alertes deviennent — ou ne
deviennent jamais — une opportunité commerciale crédible.

Principe fondateur, rappelé de P11.0 et strictement respecté ici : une
alerte n'est jamais une opportunité. Une opportunité n'existe que lorsque
plusieurs alertes cohérentes convergent vers un projet probable, une
transformation probable, une situation opérationnelle ou réglementaire
génératrice d'un besoin, ou un besoin futur probable, chez un donneur
d'ordre, un porteur de projet ou un bénéficiaire final identifiable. Les
compétences et références de l'entreprise cliente ne servent qu'à
justifier une offre déjà recommandée — elles ne doivent jamais, seules,
déclencher la création d'une opportunité.

---

## 1. La chaîne complète de raisonnement

```
Alertes observées
  ↓
Extraction des signaux faibles
  (isoler, dans chaque alerte, ce qu'elle révèle réellement — un fait daté,
   localisé, attribué à un acteur — indépendamment de toute interprétation)
  ↓
Vérification de cohérence
  (avant tout regroupement : ce signal peut-il, en principe, appartenir au
   même projet qu'un autre signal déjà connu ? voir section 3)
  ↓
Regroupement des alertes
  (uniquement les signaux ayant passé la vérification de cohérence,
   jamais par simple proximité d'entité, de mot-clé ou de zone — voir
   section 4)
  ↓
Hypothèse de projet, de transformation ou de situation génératrice d'un besoin
  (formulation explicite de ce que le regroupement laisse penser — jamais
   un simple libellé de catégorie, toujours une phrase vérifiable ; voir
   1.1 pour la nature exacte de ce que l'hypothèse peut désigner)
  ↓
Qualification de l'hypothèse
  (évaluation du niveau de confiance selon quantité, diversité, qualité
   des sources, cohérence, récence, absence de contradiction — voir
   section 6)
  ↓
Opportunité commerciale
  (l'hypothèse qualifiée devient une opportunité SI ET SEULEMENT SI son
   niveau de confiance franchit le seuil "opportunité probable" — voir
   section 6 — et est mise en regard d'une entreprise cliente précise)
  ↓
Conséquences probables
  (ce que ce type de projet entraîne généralement, à ce stade — jamais une
   liste générique, toujours dérivée de l'hypothèse et de sa phase)
  ↓
Besoins probables
  (traduction des conséquences probables en besoins concrets et
   nommables pour un donneur d'ordre — voir section 8)
  ↓
Offres recommandées
  (mise en correspondance des besoins probables avec ce que l'entreprise
   cliente sait vendre — jamais l'inverse — voir section 9)
  ↓
Références justificatives
  (preuves que l'entreprise a déjà répondu à un besoin comparable —
   viennent justifier l'offre, jamais la précéder)
  ↓
Plan d'action commercial
  (traduction de tout ce qui précède en une recommandation datée,
   nominative et argumentée)
```

Chaque flèche de ce schéma est un point de contrôle, pas une simple
transition automatique : le moteur doit pouvoir s'arrêter à n'importe
quelle étape et conclure "information insuffisante" plutôt que de forcer
le passage à l'étape suivante.

### 1.1 Nature de l'hypothèse formée

Le moteur ne doit pas se limiter à détecter des "projets" ou des "besoins
futurs" au sens strict. Ce que le regroupement d'alertes laisse penser
peut prendre l'une de ces quatre formes, chacune tout aussi légitime que
les autres pour fonder une opportunité :

- **un projet probable** — une réalisation nouvelle et identifiable (ex.
  construction d'un site, renouvellement d'une flotte) ;
- **une transformation probable** — une évolution d'un existant, sans
  qu'il s'agisse d'un projet nouveau à proprement parler (ex.
  modernisation d'un équipement, réorganisation après acquisition) ;
- **une situation opérationnelle ou réglementaire génératrice d'un
  besoin** — une contrainte ou un événement subi, non choisi comme un
  "projet", mais qui engendre néanmoins un besoin identifiable (ex. mise
  en conformité ICPE, maintenance exceptionnelle, sécurisation
  réglementaire, réduction des consommations imposée par une hausse de
  coûts) ;
- **un besoin futur probable**, lorsque la situation d'origine reste
  encore incertaine mais que le besoin lui-même commence à se dessiner.

La formulation à utiliser, partout où ce document ou une future
implémentation doit désigner ce que l'hypothèse représente, est :
**"hypothèse de projet, de transformation ou de situation génératrice
d'un besoin"**. Cette formulation remplace, partout dans ce document, tout
raccourci qui limiterait le moteur aux seuls "projets" ou "besoins
futurs" au sens le plus étroit.

---

## 2. Les types de signaux faibles

Un signal faible n'est jamais, à lui seul, une preuve de projet. Chaque
type ci-dessous est caractérisé par ce qu'il permet réellement d'observer,
ce qu'il peut suggérer, ce qu'il ne permet jamais de conclure seul, sa
force probante, et les signaux complémentaires nécessaires pour le
transformer en élément confirmant.

| Type de signal | Ce qu'il observe réellement | Ce qu'il peut suggérer | Ce qu'il ne permet pas de conclure seul | Force probante | Signaux nécessaires pour confirmer |
|---|---|---|---|---|---|
| **Foncier** (mutation, acquisition de parcelle) | Un transfert de propriété daté et localisé | Une intention d'implantation ou d'extension future | Que le terrain sera effectivement construit, ni dans quel délai | Faible seule | Permis, urbanisme, ou communication institutionnelle sur le même lieu |
| **Urbanisme** (modification PLU, compatibilité) | Un changement réglementaire local | Qu'un projet est en préparation sur la zone concernée | L'identité du porteur de projet, ni sa nature précise | Faible à moyenne | Foncier, permis, ou déclaration publique de l'acteur |
| **ICPE** (arrêté préfectoral, mise en demeure, autorisation) | Une contrainte ou autorisation environnementale réelle et actée | Une mise en conformité, une extension ou une modernisation à venir | Le budget ni le calendrier exact des travaux | Moyenne à forte (acte officiel) | Budget, consultation, ou second arrêté confirmant l'évolution |
| **Budget** (vote, délibération budgétaire) | Une décision de dépense actée par une collectivité | Un projet dont le financement est désormais sécurisé | La nature technique précise du projet | Forte si acte officiel | Délibération complémentaire, consultation, ou permis |
| **Recrutement** (offre d'emploi, annonce de poste) | Une intention de renforcement d'équipe sur une fonction précise | Une activité en développement dans ce domaine | Un projet précis ni son calendrier | Faible seule | Communication institutionnelle, investissement, ou extension |
| **Communication institutionnelle** (communiqué, discours, rapport annuel) | Une intention déclarée par l'acteur lui-même | Une orientation stratégique | Un engagement ferme ni un calendrier opérationnel | Faible à moyenne (déclaratif) | Acte administratif ou budgétaire confirmant l'intention |
| **Financement** (levée de fonds, subvention accordée, prêt) | Une ressource financière effectivement obtenue | Une capacité d'investissement à court/moyen terme | La destination précise des fonds | Moyenne à forte | Consultation, appel d'offres, ou permis lié à l'usage des fonds |
| **Partenariat** (accord, convention entre deux acteurs) | Une collaboration formalisée | Une action conjointe à venir | Le contenu opérationnel exact de la collaboration | Faible à moyenne | Communication complémentaire précisant l'objet du partenariat |
| **Investissement** (annonce d'investissement, plan pluriannuel) | Un montant et une intention déclarés | Une réalisation à venir dans le périmètre annoncé | Le détail technique des besoins engendrés | Moyenne | Permis, consultation, ou foncier dans le même périmètre |
| **Consultation** (avis de marché, sourcing, appel à candidatures) | Une intention d'achat formalisée et datée | Un besoin précis et proche dans le temps | Le résultat de la consultation (attribution) | Forte (acte formel proche de la décision) | Résultat d'attribution, ou confirmation budgétaire déjà connue |
| **Permis** (permis de construire, d'aménager, déclaration préalable) | Une autorisation ou demande d'autorisation actée | Un projet de construction/aménagement concret | Le calendrier réel de réalisation | Forte | Foncier antérieur, consultation à venir |
| **Subvention** (attribution de subvention publique) | Un soutien financier officiellement accordé | Un projet dont une partie du financement est sécurisée | Le périmètre technique complet du projet | Moyenne à forte | Budget complémentaire, consultation |
| **Changement de gouvernance** (nomination, élection, changement de direction) | Un changement de décideur effectif | Une possible réorientation stratégique à venir | Qu'un projet précis en découlera | Faible seule, mais change la lecture des décideurs | Communication institutionnelle ultérieure du nouveau décideur |
| **Acquisition** (rachat d'entreprise, de site, de fonds de commerce) | Une opération capitalistique actée | Une réorganisation ou un investissement à venir sur le site acquis | Le calendrier ni la nature des travaux éventuels | Moyenne | Permis, ICPE, ou recrutement sur le site acquis |
| **Extension** (annonce ou permis d'extension de site) | Une intention ou décision d'agrandissement | Des besoins de construction, d'équipement, de mise en conformité | Le détail des lots techniques concernés | Moyenne à forte selon l'acte | Permis, ICPE, consultation |
| **Modernisation** (annonce de mise à niveau d'un site ou d'un process) | Une intention de transformation d'un existant | Des besoins d'ingénierie, d'équipement, de mise en conformité | Le périmètre exact des travaux | Faible à moyenne (souvent déclaratif) | Consultation, permis, ICPE |
| **Fermeture ou relocalisation** (annonce de fermeture, déménagement) | Un changement de site ou d'activité acté ou annoncé | Une cessation de besoins sur un site, ou de nouveaux besoins sur un autre | Le calendrier exact ni le devenir des besoins historiques | Moyenne | Foncier ou permis sur le nouveau site, communication complémentaire |
| **Autre signal pertinent** (catégorie ouverte, ex. : contentieux, articles sectoriels, veille associative) | Dépend strictement de la nature exacte du signal — jamais présumé | À évaluer au cas par cas selon les mêmes critères que ci-dessus | Ne jamais lui accorder par défaut une force probante supérieure aux catégories connues | À évaluer, jamais "moyenne" par défaut | Toujours au moins un signal d'une catégorie mieux caractérisée |

Règle transversale : aucun type de signal, même le plus fort (permis,
consultation), ne suffit à constituer seul une opportunité "fortement
confirmée" (voir section 6) — il peut au mieux positionner l'hypothèse en
"opportunité probable" en attendant un second signal indépendant.

---

## 3. Règles strictes de regroupement des alertes

### 3.1 Rappel du principe

Le moteur ne regroupe jamais deux alertes au seul motif qu'elles
partagent une mairie, une entreprise ou une zone géographique. L'exemple
de référence (cantine biologique / achat de véhicules pour la même
mairie) illustre exactement le cas à empêcher : même donneur d'ordre, mais
projet, secteur, besoin et chaîne de décision totalement différents.

### 3.2 Critères obligatoires (sans eux, jamais de regroupement)

1. **Même donneur d'ordre, même porteur de projet, ou même bénéficiaire
   final** — les alertes doivent concerner le même donneur d'ordre, le
   même porteur de projet, le même bénéficiaire final, ou des entités
   dont le lien avec le projet est explicitement démontré (voir 3.2 bis).
   Ce critère n'impose pas une identité juridique stricte : une commune
   et son EPCI de rattachement, une maison mère et sa filiale, un
   aménageur et son exploitant, une société de projet et son
   actionnaire, un établissement public et sa tutelle, ou une SEM et sa
   collectivité actionnaire, peuvent tous porter ou révéler un seul et
   même projet. À l'inverse, la simple appartenance au même groupe
   capitalistique ou au même territoire administratif ne suffit jamais,
   seule, à établir ce lien (ex. deux filiales d'un même groupe engagées
   sur des projets sans rapport ; deux services d'une même commune sur
   deux sujets différents).
2. **Même projet ou finalité probable** — les deux alertes doivent
   raisonnablement décrire une seule et même intention (ex. deux signaux
   sur "renouvellement de la flotte de véhicules", pas un signal sur les
   véhicules et un autre sur la restauration).
3. **Compatibilité temporelle** — les alertes doivent s'inscrire dans une
   fenêtre de temps cohérente avec la durée de vie plausible d'un même
   projet (voir 3.3, compatibilité avec la phase).
4. **Absence de contradiction majeure** — aucune des alertes ne doit
   contredire frontalement une information déjà retenue dans le
   regroupement (montant incompatible, lieu incompatible, acteur
   explicitement différent).

### 3.2 bis — Preuves acceptables du lien entre entités liées

Le critère obligatoire n°1 autorise le regroupement d'alertes concernant
des entités juridiquement distinctes mais liées au même projet, à
condition qu'au moins une preuve explicite établisse ce lien — jamais une
simple supposition de proximité, de secteur ou de territoire commun.
Configurations typiques et preuves attendues :

- **Commune et EPCI de rattachement** — preuve : une délibération, une
  convention, ou une communication mentionnant explicitement la
  compétence transférée ou partagée sur le projet concerné.
- **Maison mère et filiale** — preuve : une mention explicite du lien
  capitalistique dans l'une des alertes (ex. "sa filiale", "groupe X, à
  travers sa filiale Y"), ou deux alertes citant le même projet sous les
  deux raisons sociales.
- **Aménageur et exploitant** — preuve : un même permis, une même
  convention d'aménagement, ou une communication désignant explicitement
  l'un comme opérateur du projet porté par l'autre.
- **Société de projet et actionnaire** — preuve : une mention explicite
  de la société de projet comme véhicule dédié de l'actionnaire pour
  l'opération concernée (ex. "société de projet détenue par").
- **Établissement public et tutelle** — preuve : un acte de tutelle
  (arrêté, décision, communiqué) rattachant explicitement l'établissement
  au projet porté ou financé par l'autorité de tutelle.
- **SEM et collectivité actionnaire** — preuve : une délibération de la
  collectivité mandatant explicitement la SEM pour le projet, ou une
  communication commune sur le même objet.

En l'absence d'une telle preuve, le lien entre les deux entités reste à
l'état de doute (voir 3.5, critères de doute) et ne peut jamais fonder,
seul, un regroupement au titre du critère obligatoire n°1.

### 3.3 Critères renforçants (augmentent la confiance, non obligatoires)

- Même périmètre géographique précis (parcelle, bâtiment, zone
  d'activité) plutôt qu'une simple commune.
- Même secteur ou domaine fonctionnel (ex. mobilité, bâtiment scolaire,
  industrie lourde).
- Compatibilité avec la phase du projet (un signal de "consultation"
  après un signal de "budget voté" renforce ; un signal de "consultation"
  avant tout signal budgétaire antérieur reste possible mais moins fort).
- Proximité sémantique réelle entre les intitulés et résumés (pas de
  simple présence d'un mot-clé commun — voir 3.6).
- Cohérence entre montants, lieux et acteurs cités d'une alerte à
  l'autre.
- Continuité logique entre les événements (ex. délibération puis
  consultation puis attribution, dans cet ordre plausible).

### 3.4 Critères d'exclusion (imposent la séparation)

- Deux alertes concernant le même donneur d'ordre mais des secteurs
  fonctionnels manifestement distincts et sans lien opérationnel (l'
  exemple cantine bio / véhicules).
- Montants manifestement incompatibles avec un seul et même projet (ex.
  un montant de quelques milliers d'euros et un autre de plusieurs
  dizaines de millions, sans justification de sous-lot).
- Localisations distinctes sans lien de rattachement connu (deux sites
  différents, sans preuve qu'ils appartiennent au même programme).
- Entités juridiques différentes sans lien capitalistique ou
  administratif établi.
- Chronologie incompatible avec un même cycle de projet (ex. un signal de
  "mise en service" suivi, des mois plus tard, d'un signal d'
  "intention"  sur le même objet — signe que ce sont deux projets
  distincts, pas une seule chronologie).

### 3.5 Critères de doute (signal contextuel, jamais confirmant)

- Lien thématique plausible mais donneur d'ordre non strictement
  identique (ex. un syndicat intercommunal et une commune membre).
- Fenêtre temporelle large mais non déraisonnable (ex. 8 à 18 mois
  d'écart selon la nature du projet).
- Proximité sémantique modérée, sans élément factuel de recoupement
  (montant, lieu précis, référence commune).
- Source unique de fiabilité faible (déclaratif tiers, presse non
  officielle) sans recoupement.

Dans tous ces cas, l'alerte est conservée et affichée (voir P11.0, section
5, "Alertes liées"), mais son rôle est explicitement "signal contextuel"
— elle n'augmente jamais, seule, le niveau de confiance de l'hypothèse.

### 3.6 Mise en garde explicite : sémantique vs mots-clés

La proximité sémantique (3.3) n'est jamais la simple présence d'un mot-clé
commun. "Véhicules" apparaissant dans une alerte sur des bennes à ordures
et dans une alerte sur des voitures de fonction ne constitue pas une
proximité sémantique valable : le secteur, le budget et le service
prescripteur diffèrent. La proximité sémantique valable porte sur
l'intention métier reconstituée (le "projet probable" lui-même), jamais
sur le vocabulaire brut des alertes.

---

## 4. L'unité réelle de regroupement

Le moteur ne construit jamais une opportunité autour d'une entreprise,
d'une mairie, d'un mot-clé, d'un secteur ou d'une zone géographique pris
isolément. L'unité de regroupement est toujours une **hypothèse de
projet, de transformation ou de situation génératrice d'un besoin** (voir
1.1), formulée explicitement, vérifiable, et suffisamment précise pour
qu'on puisse dire ce qui lui appartient et ce qui ne lui appartient pas.

**Exemple de référence :**

```
Entité : Ville X
Projet probable : renouvellement de la flotte de véhicules municipaux
```

Appartiennent à cette hypothèse (même finalité probable) :
- vote d'un budget mobilité ;
- délibération sur le renouvellement du parc ;
- publication d'un plan de transition énergétique (s'il mentionne
  explicitement la flotte municipale) ;
- recrutement d'un responsable de flotte ;
- consultation préparatoire sur des véhicules.

N'appartiennent pas à cette hypothèse, même si elles concernent la même
Ville X (secteur et finalité différents) :
- restauration scolaire ;
- rénovation d'une école ;
- achat de mobilier administratif.

Chaque hypothèse doit pouvoir être formulée en une phrase testable :
"il est probable que [entité] engage [type de projet] concernant [objet],
actuellement en phase [phase]". Si une alerte candidate ne peut pas être
rattachée sans reformuler cette phrase, elle n'appartient pas au
regroupement.

---

## 5. Comment les signaux se renforcent

### 5.1 Renforcement par indépendance

Une hypothèse gagne en confiance lorsque plusieurs alertes **provenant de
sources indépendantes** (une source publique officielle + une source
déclarative + une source presse, par exemple) convergent vers la même
hypothèse. La diversité des sources est un renforcement parce qu'elle
réduit le risque qu'une seule erreur, un seul biais ou une seule
rumeur explique l'ensemble du signal.

### 5.2 Non-cumul des reprises d'un même document

Plusieurs alertes issues d'un seul et même document source (ex. trois
reprises presse d'un même communiqué, ou un communiqué et sa reprise
automatique sur un portail agrégateur) **ne comptent jamais comme
plusieurs confirmations indépendantes**. Elles comptent comme un seul
signal, avec une seule force probante — celle du document d'origine.
Le moteur doit identifier ce cas par recoupement de contenu (même
formulation, même date de publication, même chiffres) avant tout calcul
de confiance, et ne conserver qu'une occurrence représentative dans le
décompte de signaux indépendants (les autres restent visibles comme
"reprises", pas comme signaux distincts).

### 5.3 Les quatre rôles d'un signal dans la corrélation

- **Signal déclencheur** : première alerte ayant fait émerger l'hypothèse
  — c'est elle qui a permis de formuler le projet probable.
- **Signal confirmant** : alerte indépendante, cohérente avec l'
  hypothèse, qui augmente réellement la confiance (a passé les critères
  obligatoires de la section 3.2, et idéalement plusieurs renforçants).
- **Signal contextuel** : alerte cohérente mais insuffisamment
  indépendante ou insuffisamment précise pour confirmer seule (voir
  3.5) — utile pour la compréhension, jamais pour le calcul de
  confiance.
- **Alerte hors sujet** : alerte initialement rapprochée puis exclue
  (critères d'exclusion, 3.4) — reste tracée comme "évaluée puis écartée",
  jamais simplement supprimée silencieusement.

### 5.4 Logique combinatoire (pas de seuil numérique unique)

Le moteur ne doit jamais fixer un nombre minimum unique et arbitraire
d'alertes pour créer une opportunité. La confiance résulte de la
combinaison de :

- **quantité** de signaux distincts (après dédoublonnage, 5.2) ;
- **diversité** des sources et des types de signaux ;
- **qualité des sources** (officielle > déclarative > tierce) ;
- **cohérence** interne (aucune contradiction, section 3.4) ;
- **récence** (des signaux trop anciens perdent leur force probante,
  voir section 7) ;
- **complémentarité** (les signaux couvrent des aspects différents du
  projet — budget + autorisation + consultation — plutôt que de répéter
  le même aspect sous des formulations différentes) ;
- **absence de contradiction**, y compris avec des signaux extérieurs au
  regroupement (ex. une communication ultérieure de fermeture du même
  site).

Trois signaux forts, indépendants et complémentaires (ex. un budget voté
+ un permis déposé + une consultation publiée) constituent une hypothèse
plus crédible que dix reprises presse d'une seule déclaration
d'intention. La force ne se mesure jamais au nombre brut d'alertes.

---

## 6. Les niveaux de confiance

Sept niveaux, du moins au plus caractérisé, plus un niveau d'échec
explicite (contradiction).

### 6.1 Signal isolé

- **Entrée** : une seule alerte, aucun regroupement possible pour l'
  instant.
- **Sortie** : dès qu'une deuxième alerte indépendante et cohérente
  apparaît → passage à "hypothèse émergente".
- **Signaux attendus** : aucun autre nécessaire à ce stade, c'est l'état
  initial.
- **Contradictions acceptables** : sans objet (rien à contredire encore).
- **Affichage commercial** : visible en veille brute uniquement, jamais
  présenté comme une opportunité.
- **Exploitable ?** Non.

### 6.2 Hypothèse émergente

- **Entrée** : deux alertes cohérentes (critères obligatoires satisfaits,
  section 3.2), mais peu ou pas de critères renforçants, ou sources peu
  diversifiées.
- **Sortie** : vers "hypothèse plausible" si un critère renforçant
  significatif apparaît (nouvelle source indépendante, ou signal
  complémentaire touchant un autre aspect du projet) ; retour à "signal
  isolé" si l'une des deux alertes est retirée (voir section 10).
- **Signaux attendus** : au moins un signal complémentaire de nature
  différente (ex. un signal foncier + un signal de communication).
- **Contradictions acceptables** : aucune contradiction majeure tolérée
  même à ce stade précoce.
- **Affichage commercial** : visible comme "à surveiller", explicitement
  non actionnable.
- **Exploitable ?** Non, sauf mention explicite "hypothèse précoce,
  aucune action recommandée".

### 6.3 Hypothèse plausible

- **Entrée** : plusieurs alertes cohérentes, au moins deux sources
  indépendantes, au moins un critère renforçant net (temporalité
  cohérente, proximité sémantique réelle).
- **Sortie** : vers "opportunité probable" si un signal fort (permis,
  consultation, budget voté) rejoint le regroupement ; peut redescendre
  en "hypothèse émergente" après un retrait d'alerte.
- **Signaux attendus** : au moins un signal de force moyenne à forte
  (voir section 2) en plus des signaux faibles initiaux.
- **Contradictions acceptables** : une contradiction mineure et
  explicable (ex. léger écart de montant entre deux communications) peut
  être tolérée si elle est explicitement documentée, jamais ignorée
  silencieusement.
- **Affichage commercial** : visible avec un résumé de l'hypothèse et son
  niveau, présenté comme "à qualifier", pas encore comme actionnable.
- **Exploitable ?** Non, sauf action de veille ("à surveiller
  activement").

### 6.4 Opportunité probable

- **Entrée** : au moins un signal fort et indépendant confirme l'
  hypothèse plausible, sans contradiction non résolue.
- **Sortie** : vers "opportunité fortement confirmée" avec un second
  signal fort indépendant ; vers "hypothèse contradictoire" si un signal
  ultérieur contredit un élément central.
- **Signaux attendus** : au moins deux signaux de nature différente,
  dont un de force moyenne à forte.
- **Contradictions acceptables** : aucune contradiction non expliquée.
- **Affichage commercial** : c'est le premier niveau où l'opportunité
  apparaît comme telle dans le tableau de bord commercial, avec mention
  explicite du niveau "probable" (jamais présentée comme certaine).
- **Exploitable ?** Oui, avec réserve explicite affichée.

### 6.5 Opportunité fortement confirmée

- **Entrée** : au moins deux signaux forts, indépendants, complémentaires
  (couvrant des aspects différents du projet), cohérents entre eux.
- **Sortie** : reste à ce niveau tant qu'aucun retrait ni contradiction
  n'intervient ; peut redescendre en cas de retrait d'un signal
  structurant (voir section 10).
- **Signaux attendus** : couverture d'au moins deux dimensions
  différentes du projet (ex. financière + réglementaire, ou foncière +
  organisationnelle).
- **Contradictions acceptables** : aucune.
- **Affichage commercial** : opportunité présentée pleinement, avec
  argumentaire et plan d'action.
- **Exploitable ?** Oui, pleinement.

### 6.6 Hypothèse contradictoire

- **Entrée** : au moins un signal contredit frontalement un élément déjà
  retenu (montant, lieu, acteur, ou annonce d'arrêt/annulation du
  projet).
- **Sortie** : vers un niveau inférieur après arbitrage (retrait du
  signal contradictoire s'il s'avère erroné, ou dégradation de
  l'hypothèse si la contradiction est confirmée) — jamais de sortie
  automatique sans revue.
- **Signaux attendus** : sans objet — c'est un état d'alerte, pas un
  état de progression.
- **Contradictions acceptables** : par définition, aucune — c'est l'état
  qui signale leur présence.
- **Affichage commercial** : signalé explicitement comme "contradiction
  détectée", jamais présenté comme une opportunité exploitable tant que
  la contradiction n'est pas résolue.
- **Exploitable ?** Non.

### 6.7 Information insuffisante

- **Entrée** : signaux trop pauvres, trop anciens, ou trop génériques
  pour permettre de qualifier une hypothèse même émergente (voir section
  7 pour les cas explicites).
- **Sortie** : vers "signal isolé" ou "hypothèse émergente" si de
  nouveaux signaux qualifiants apparaissent.
- **Signaux attendus** : n'importe quel signal apportant une
  spécification concrète (lieu, acteur, montant, date).
- **Contradictions acceptables** : sans objet.
- **Affichage commercial** : le moteur doit explicitement pouvoir dire
  "nous ne savons pas encore" plutôt que de forcer une hypothèse.
- **Exploitable ?** Non, jamais.

**Règle absolue** : le moteur ne doit jamais créer artificiellement une
opportunité pour remplir le tableau de bord commercial. L'absence
d'opportunité qualifiée est un résultat légitime et doit être présentée
comme tel.

---

## 7. Cas où aucune opportunité ne doit être créée

1. **Une seule alerte isolée** — jamais suffisant, quel que soit son
   niveau de force probante individuel.
2. **Alertes trop éloignées dans le temps** — au-delà d'une durée
   incompatible avec le cycle de vie plausible du type de projet
   concerné (un projet industriel tolère un écart plus large qu'un achat
   courant).
3. **Alertes concernant des projets différents** — même si elles
   partagent un vocabulaire proche (voir section 3.6).
4. **Même donneur d'ordre, mais finalités sans rapport** — exemple de
   référence (cantine bio / véhicules).
5. **Signaux contradictoires** non résolus (voir 6.6).
6. **Localisation incohérente** — sites différents sans lien de
   rattachement établi.
7. **Entités juridiques différentes** — sans lien capitalistique ou
   administratif démontré.
8. **Simple répétition médiatique** d'une même information (voir 5.2) —
   ne constitue jamais, à elle seule, un renforcement.
9. **Données trop anciennes** — un signal dont la pertinence opérationnelle
   est manifestement expirée (ex. une consultation dont le résultat est
   probablement déjà connu et non recoupé) ne doit plus alimenter une
   hypothèse active.
10. **Information purement déclarative sans confirmation** — une
    intention affichée (communication institutionnelle) sans aucun acte
    complémentaire reste au niveau "signal isolé" ou "hypothèse
    émergente", jamais au-delà.
11. **Alerte manifestement hors sujet** — détectée et exclue plutôt
    qu'ignorée silencieusement (traçabilité, voir section 5.3).
12. **Corrélation fondée uniquement sur des mots-clés génériques** — sans
    proximité sémantique réelle au sens de la section 3.6.

---

## 8. De l'hypothèse aux besoins probables

Le passage de l'hypothèse aux besoins suit trois étapes explicites,
jamais fusionnées : conséquences probables → prochaines étapes probables
→ besoins probables nommables. Chaque besoin final doit pouvoir être
retracé jusqu'aux alertes qui l'ont motivé. Ce mécanisme s'applique de la
même façon que l'hypothèse retenue soit un projet, une transformation ou
une situation génératrice d'un besoin (voir 1.1) — seule la nature des
conséquences probables change, jamais la rigueur de la chaîne de
justification.

**Exemple de référence :**

```
Projet probable :
Construction d'un nouveau site industriel

Conséquences probables :
- études de faisabilité ;
- acquisition ou préparation du foncier ;
- autorisations administratives ;
- conception ;
- consultation ;
- travaux ;
- mise en service.

Besoins probables :
- AMO ;
- études ICPE ;
- ingénierie ;
- maîtrise d'œuvre ;
- assistance au choix des prestataires ;
- mise en service.
```

Chaque besoin listé doit être accompagné, dans le raisonnement du moteur
(pas nécessairement affiché en permanence à l'écran, voir P11.0), de :

- les alertes observées qui l'ont motivé ;
- les signaux faibles sous-jacents ;
- l'hypothèse retenue au moment du calcul ;
- la phase probable du projet à cet instant.

**Second exemple, pour une situation génératrice d'un besoin (non un
projet nouveau) :**

```
Situation génératrice de besoin :
Mise en demeure ICPE sur un site industriel existant

Conséquences probables :
- diagnostic technique de conformité ;
- plan d'actions correctives sous délai imposé ;
- travaux de mise à niveau ;
- suivi de contrôle post-travaux.

Besoins probables :
- étude ICPE / diagnostic de conformité ;
- ingénierie de mise à niveau ;
- accompagnement réglementaire jusqu'à levée de la mise en demeure.
```

D'autres situations de cette nature suivent la même logique : maintenance
exceptionnelle après incident, réorganisation après acquisition,
modernisation d'un équipement vieillissant, réduction imposée des
consommations énergétiques, ou sécurisation réglementaire suite à une
évolution de norme — dans tous les cas, le moteur déduit des besoins
probables à partir d'une contrainte subie, et non d'un projet choisi, en
appliquant exactement la même exigence de traçabilité.

Un besoin ne doit jamais apparaître sans cette chaîne de justification
complète. Si la chaîne ne peut pas être reconstituée, le besoin ne doit
pas être proposé.

---

## 9. La recommandation des offres

L'ordre de raisonnement est strict et ne s'inverse jamais :

```
Projet ou besoin probable
  ↓
Conséquences probables
  ↓
Besoins probables
  ↓
Offres de l'entreprise
  ↓
Références similaires
  ↓
Compétences justificatives
  ↓
Argument commercial
```

Les compétences de l'entreprise n'entrent en jeu qu'à l'avant-dernière
étape, pour justifier une offre déjà choisie parce qu'elle répond à un
besoin déjà déduit — jamais en amont pour décider quelles opportunités
existent.

Pour chaque offre recommandée, le raisonnement doit expliciter :

- le besoin précis auquel elle répond ;
- les alertes et déductions qui justifient ce besoin (chaîne remontant
  jusqu'à la section 8, elle-même remontant jusqu'à la section 1) ;
- les références similaires de l'entreprise, si elles existent ;
- les compétences qui justifient techniquement la capacité de
  l'entreprise à répondre ;
- le niveau de confiance global de l'opportunité sous-jacente (jamais un
  score de pertinence de l'offre déconnecté du niveau de confiance du
  projet) ;
- les éventuelles réserves (ex. "besoin déduit d'un seul signal de
  catégorie ICPE, à confirmer avant prise de contact").

---

## 10. Contrôle humain des alertes liées

### 10.1 L'action de retrait

Dans la section "Alertes liées" (P11.0), chaque alerte dispose d'une
action explicite : **"Retirer cette alerte de l'opportunité"**. Cette
action ne supprime jamais l'alerte de la base globale — elle supprime
uniquement le lien entre cette alerte et cette opportunité précise.
L'alerte reste disponible pour, potentiellement, alimenter une autre
opportunité, ou aucune.

### 10.2 Confirmation avant validation

Avant toute suppression de lien, une confirmation explicite doit
présenter les conséquences attendues, en particulier :

- recalcul du nombre de signaux ;
- recalcul du niveau de confiance ;
- recalcul de la phase probable du projet ;
- recalcul du résumé ("que pensons-nous ?") ;
- recalcul des besoins probables ;
- recalcul des offres recommandées ;
- recalcul du plan d'action commercial.

### 10.3 Recalcul automatique et trois issues possibles

Après confirmation, le moteur recalcule intégralement la chaîne à partir
de la section 1, en excluant l'alerte retirée. Trois issues sont
possibles :

1. **L'opportunité reste valide** — le niveau de confiance et les
   recommandations sont recalculés à la baisse ou à l'identique, mais
   restent au-dessus du seuil "opportunité probable" (section 6.4).
2. **L'opportunité devient insuffisamment étayée** — le recalcul la fait
   redescendre à "hypothèse plausible" ou "hypothèse émergente" (sections
   6.2-6.3) ; elle change de statut visible en "hypothèse à confirmer",
   retirée de la liste des opportunités présentées comme exploitables
   mais toujours consultable.
3. **L'opportunité n'a plus de cohérence suffisante** — le recalcul la
   fait tomber à "information insuffisante" (6.7) ou révèle qu'il ne
   reste qu'un signal isolé (6.1) ; elle est retirée de la liste des
   opportunités exploitables, sans qu'aucune alerte source ne soit
   supprimée.

### 10.4 Traçabilité obligatoire

Chaque retrait doit conserver, de façon durable :

- qui a retiré l'alerte ;
- quand ;
- pour quelle raison (voir taxonomie section 11) ;
- l'ancien niveau de confiance ;
- le nouveau niveau de confiance.

### 10.5 Réintégration

Une action d'annulation/réintégration du lien doit rester possible tant
que l'alerte n'a pas été rattachée entre-temps à une autre opportunité
(le moteur doit alerter l'utilisateur si ce cas se présente plutôt que de
réintégrer silencieusement un lien devenu ambigu).

---

## 11. Amélioration du moteur par les corrections humaines

Chaque retrait manuel constitue un retour métier précieux, à conserver
sous forme de motif structuré (jamais un simple texte libre non
catégorisé) :

- alerte hors sujet ;
- mauvaise entité ;
- mauvais projet ;
- doublon ;
- temporalité incohérente ;
- mauvaise localisation ;
- mauvais rapprochement sémantique.

Ces motifs, accumulés dans le temps, constituent un **corpus de
validation métier** : un ensemble de cas réels où le regroupement
automatique s'est révélé incorrect, avec la raison exacte de l'erreur.
Ce corpus sert à revoir périodiquement, avec le métier, les critères des
sections 3 et 6 (par exemple, si "mauvais rapprochement sémantique" est
le motif le plus fréquent sur un secteur donné, cela indique que les
critères de proximité sémantique de ce secteur doivent être resserrés).

Ce document ne propose ni n'anticipe aucun apprentissage automatique, ni
aucune modification automatique et opaque des règles à partir de ce
corpus. Toute évolution des règles de corrélation reste une décision
métier explicite, prise à partir de ce corpus, jamais une conséquence
automatique et silencieuse des retraits observés.

---

## 12. Quatre cas complets

Chaque cas suit le même schéma de lecture :

```
Alertes
  ↓
Analyse de cohérence
  ↓
Signaux retenus
  ↓
Signaux exclus
  ↓
Hypothèse
  ↓
Confiance
  ↓
Besoins probables
  ↓
Offres recommandées
  ↓
Décision finale
```

### Cas A — Opportunité industrielle crédible

- **Alertes** : (1) mutation foncière sur une parcelle industrielle,
  source cadastrale ; (2) arrêté préfectoral ICPE d'autorisation
  environnementale sur la même parcelle, deux mois plus tard ; (3)
  communiqué de presse du groupe industriel annonçant "un investissement
  dans la région" (sans lieu précis) ; (4) avis de consultation pour des
  "travaux de VRD" à la même adresse, un mois plus tard.
- **Analyse de cohérence** : même localisation précise pour (1), (2) et
  (4) ; (3) partiellement cohérent (même acteur, région large mais pas
  l'adresse précise) ; chronologie plausible (foncier → autorisation →
  consultation) ; aucune contradiction.
- **Signaux retenus** : (1) déclencheur, (2) confirmant, (4) confirmant ;
  (3) contextuel (source indépendante mais moins précise géographiquement).
- **Signaux exclus** : aucun.
- **Hypothèse** : construction/extension d'un site industriel sur cette
  parcelle, phase "autorisation obtenue, consultation en cours".
- **Confiance** : opportunité fortement confirmée (deux signaux forts
  indépendants — ICPE et consultation — couvrant deux dimensions
  différentes : réglementaire et opérationnelle).
- **Besoins probables** : VRD, ingénierie, éventuellement AMO si la
  consultation le mentionne.
- **Offres recommandées** : offre VRD/ingénierie de l'entreprise cliente,
  justifiée par une référence sur un site industriel comparable.
- **Décision finale** : opportunité présentée pleinement, avec plan
  d'action (contacter le service technique avant la clôture de la
  consultation).

### Cas B — Même donneur d'ordre, projets différents

- **Alertes** : (1) délibération municipale sur l'introduction de
  produits biologiques dans les cantines scolaires ; (2) délibération de
  la même commune, même séance de conseil municipal, sur l'achat de
  véhicules pour les services techniques.
- **Analyse de cohérence** : même donneur d'ordre et même date, mais
  secteur fonctionnel totalement distinct (restauration scolaire vs
  parc automobile), aucune finalité commune, aucun acteur opérationnel
  partagé.
- **Signaux retenus** : aucun regroupement — chaque alerte reste un
  signal isolé de son propre côté.
- **Signaux exclus** : (2) explicitement exclu du regroupement autour de
  (1), et réciproquement — critère d'exclusion "finalités sans rapport"
  (section 3.4).
- **Hypothèse** : deux hypothèses distinctes et non liées : "révision de
  la politique de restauration scolaire" d'une part, "renouvellement du
  parc de véhicules municipaux" d'autre part.
- **Confiance** : signal isolé pour chacune des deux hypothèses en l'
  état (une seule alerte chacune).
- **Besoins probables** : non calculés à ce stade (confiance
  insuffisante).
- **Offres recommandées** : aucune à ce stade.
- **Décision finale** : aucune opportunité créée ; les deux alertes
  restent en veille, séparément, dans l'attente d'un second signal propre
  à chacune.

### Cas C — Alerte mal rattachée

- **Contexte initial** : une opportunité "extension d'un site logistique"
  regroupait trois alertes : (1) foncier, (2) permis de construire, (3)
  une alerte de recrutement pour "responsable logistique" dans la même
  ville, initialement rattachée comme signal contextuel.
- **Intervention du commercial** : en consultant la fiche, le commercial
  identifie que l'entreprise qui recrute (3) est une enseigne de
  distribution alimentaire sans lien avec le porteur du projet foncier
  (1)/(2), qui est un logisticien tiers. Il retire l'alerte (3) via
  "Retirer cette alerte de l'opportunité", motif "mauvaise entité".
- **Confirmation affichée** : recalcul du nombre de signaux (3 → 2),
  recalcul du niveau de confiance, recalcul des besoins probables (le
  besoin "recrutement à accompagner" disparaît), recalcul du plan d'
  action.
- **Recalcul** : les deux signaux restants (foncier + permis) restent
  cohérents entre eux et suffisants pour rester en "opportunité probable"
  (un signal fort — le permis — confirme le foncier).
- **Décision finale** : issue n°1 de la section 10.3 — l'opportunité
  reste valide, avec une confiance et un plan d'action recalculés ; l'
  alerte (3) redevient un signal isolé disponible pour une future
  opportunité distincte ; traçabilité enregistrée (qui, quand, motif
  "mauvaise entité", ancienne confiance, nouvelle confiance).

### Cas D — Signaux contradictoires

- **Alertes** : (1) délibération votant un budget pour la construction
  d'un nouveau gymnase intercommunal ; (2) trois mois plus tard,
  communiqué de la même intercommunalité annonçant l'abandon du projet de
  gymnase pour raisons budgétaires.
- **Analyse de cohérence** : même donneur d'ordre, même projet précis —
  mais (2) contredit frontalement (1) sur l'existence même du projet.
- **Signaux retenus** : (1) reste tracé comme signal déclencheur
  historique ; (2) est traité comme signal de contradiction, pas comme
  signal contextuel.
- **Signaux exclus** : aucun retrait silencieux — les deux alertes restent
  visibles, la contradiction est explicitement signalée plutôt que
  masquée.
- **Hypothèse** : "construction d'un gymnase intercommunal" — statut
  requalifié.
- **Confiance** : hypothèse contradictoire (section 6.6) — dégradée
  depuis un niveau antérieur potentiellement "opportunité probable".
- **Besoins probables** : non recalculés tant que la contradiction n'est
  pas résolue (un besoin ne doit jamais être proposé sur une hypothèse
  contradictoire).
- **Offres recommandées** : aucune.
- **Décision finale** : l'opportunité n'est pas présentée comme
  exploitable ; elle apparaît explicitement comme "contradiction
  détectée — projet probablement abandonné", en attente d'une éventuelle
  résolution (nouveau signal confirmant soit l'abandon définitif, soit
  une reprise du projet).

---

## 13. Compatibilité avec l'existant (P11.0 et le système actuel)

### 13.1 Éléments existants conservés sans modification

- La distinction Alerte / Opportunité, déjà actée et jamais remise en
  cause depuis les premiers sprints : reste le socle exact de ce
  document.
- Le moteur de corrélation déterministe déjà en place (clé de
  corrélation par entité cible, type d'opportunité, géographie) reste la
  bonne mécanique de bas niveau — ce document en précise les critères
  d'admissibilité (section 3), il ne le remplace pas.
- La notion de niveau de confiance de corrélation (haute/basse), déjà
  présente, reste compatible avec les sept niveaux de la section 6 : elle
  en devient une composante d'entrée, pas un concept concurrent.
- Les liens alerte-opportunité déjà modélisés (table de liaison
  existante) restent la bonne unité technique pour porter, demain, le
  "rôle dans la corrélation" décrit en P11.0 et détaillé ici (section
  5.3) — c'est un enrichissement de champ, pas un nouveau modèle de
  liaison.
- Les règles RLS d'isolation par entreprise, déjà en place et validées,
  restent strictement compatibles : ce document ne change rien à
  l'appartenance d'une opportunité à une entreprise cliente donnée.
- L'API et l'interface de consultation existantes (liste, détail,
  assignation, notes, journal d'activité) restent la bonne base
  d'affichage — ce document ne demande aucune refonte de ces mécanismes,
  seulement l'enrichissement des données qu'ils affichent déjà.

### 13.2 Éléments nécessitant seulement un enrichissement

- Le calcul du niveau de confiance actuel (binaire haute/basse au niveau
  de la seule corrélation) doit être enrichi pour porter les sept niveaux
  de la section 6 — enrichissement de règle de calcul, pas remplacement
  de mécanisme.
- Le contenu des "raisons" actuellement stocké doit être enrichi pour
  distinguer explicitement, par raison, sa nature (fait observé,
  déduction, contradiction) — cohérent avec le triptyque Observé/Déduit/
  Recommandé déjà posé en P11.0.
- Le lien alerte-opportunité doit être enrichi d'un champ "rôle dans la
  corrélation" (déclencheur/confirmant/contextuel/hors sujet), déjà
  identifié comme un ajout mineur en P11.0.
- Le processus de retrait d'une alerte (déjà esquissé en creux dans
  P11.0, section 5) doit être enrichi pour porter explicitement la
  traçabilité décrite ici (section 10.4) et le recalcul en cascade
  (10.3).

### 13.3 Éléments à renommer ou repositionner

- Le bloc "Pourquoi cette opportunité" actuel (raisons factuelles
  génériques) doit être repositionné comme la restitution visible du
  niveau de confiance (section 6) plutôt que comme un simple compteur de
  signaux/preuves/décideurs — même donnée sous-jacente, lecture
  repositionnée.
- Le "résumé métier" actuel doit être repositionné comme la formulation
  explicite de l'hypothèse (section 4 : "il est probable que [entité]
  engage [projet]...") plutôt que comme un paragraphe descriptif
  générique — un renommage de rôle, pas une nouvelle donnée.
- Le "niveau de confiance de corrélation" (haute/basse), aujourd'hui
  interne au calcul, doit être repositionné comme une entrée du calcul
  des sept niveaux de confiance métier (section 6), et non plus comme la
  seule information de confiance montrée à l'utilisateur.

### 13.4 Ajustements mineurs nécessaires dans P11.0

- P11.0 propose une table `besoins_probables` comme "référentiel de
  règles" — ce document précise (section 8) que chaque besoin doit
  rester traçable jusqu'aux alertes et à la phase qui l'ont motivé : le
  référentiel de règles doit donc être complété, au niveau de la
  conception détaillée (Sprint 14 de la roadmap P11.0), par cette
  exigence de traçabilité par occurrence, pas seulement par catégorie.
- P11.0 propose un champ unique `opportunite_alertes.role_correlation` —
  ce document confirme que ses quatre valeurs doivent être exactement
  déclencheur / confirmant / contextuel / hors sujet (et non une autre
  taxonomie), pour rester cohérent avec la section 5.3 ici.
- P11.0 ne détaillait pas le mécanisme de recalcul en cascade lors d'un
  retrait d'alerte : ce document (section 10) vient combler ce point
  précis avant l'implémentation du Sprint 11/12 de la roadmap P11.0.

### 13.5 Évolution par migrations additives et étapes progressives

Rien dans ce document ne justifie de repartir de zéro. La progression
recommandée :

1. Enrichir le calcul de confiance existant pour produire les sept
   niveaux de la section 6, à partir des mêmes données déjà collectées
   (nombre de signaux, sources, dates) — pas de nouvelle collecte de
   données nécessaire pour ce premier palier.
2. Ajouter le champ de rôle dans la corrélation (section 5.3), en
   réutilisant la table de liaison alerte-opportunité déjà existante.
3. Implémenter le mécanisme de retrait et de recalcul en cascade (section
   10), en s'appuyant sur les mécanismes déjà existants de recalcul de
   dossier (le même principe que la consolidation déjà en place
   aujourd'hui pour les dossiers d'opportunité, simplement déclenché par
   un nouvel événement).
4. Introduire le référentiel de besoins probables et le moteur de
   déduction (section 8), en s'appuyant sur les catégories de veille déjà
   existantes comme point d'entrée du référentiel.
5. Introduire le catalogue d'offres structuré et le matching besoin↔offre
   (section 9), en dernier, une fois que la qualité des hypothèses de
   projet (étapes 1 à 4) est jugée fiable par le métier — proposer des
   offres sur des hypothèses encore mal qualifiées serait
   contre-productif.

Chaque étape reste une migration additive (nouveaux champs, nouvelles
tables, jamais de suppression d'un champ ou d'une table existants avant
validation explicite du métier), conformément à la contrainte déjà posée
en P11.0.

### 13.6 Développements déjà réalisés à réutiliser impérativement

- Le moteur de corrélation déterministe (`CorrelationEngine` et sa clé de
  génération) : reste la mécanique de bas niveau de la section 1, jamais
  remplacé.
- Le mécanisme de consolidation de dossier existant (recalcul du résumé,
  des scores, du statut d'enrichissement à la lecture ou sur événement) :
  c'est exactement le patron de conception à réutiliser pour le recalcul
  en cascade de la section 10.3 — un nouveau type d'événement
  déclencheur (retrait d'alerte) sur un mécanisme déjà éprouvé, pas un
  nouveau mécanisme.
- Le modèle d'isolation par entreprise (RLS) déjà en place : aucune
  hypothèse de ce document ne le remet en cause — une opportunité, même
  redéfinie dans son raisonnement, reste strictement rattachée à une
  seule entreprise cliente.
- Les catégories de veille déjà existantes (les 12 catégories utilisées
  aujourd'hui : documents administratifs, presse locale, maîtrise
  foncière, urbanisme, marchés publics, délibérations, ICPE,
  actualisation de données, arrêtés préfectoraux, articles associations,
  élus locaux, budgets/investissements) : servent de point de départ
  direct pour cartographier les types de signaux de la section 2 — un
  travail de correspondance, pas une nouvelle taxonomie à inventer de
  zéro.
- Le principe déjà en vigueur "jamais de score inventé, jamais de donnée
  fabriquée" (présent dans tous les sprints précédents) : reste le
  principe directeur non négociable de l'ensemble de ce document.

---

*Fin du document P11.1 — version finale consolidée. Complémentaire au
P11.0, non modificatif. Aucun code, aucune migration, aucune branche,
aucun commit, aucune donnée modifiée.*

*Révision consolidée : (1) assouplissement du critère obligatoire relatif
à l'entité — lien démontré entre entités liées, jamais une identité
juridique stricte ni une simple proximité de groupe ou de territoire ;
(2) élargissement de l'objet de la déduction — le moteur détecte un
projet probable, une transformation probable, une situation
opérationnelle ou réglementaire génératrice d'un besoin, ou un besoin
futur probable, jamais uniquement des "projets". La structure générale en
13 sections reste inchangée.*
