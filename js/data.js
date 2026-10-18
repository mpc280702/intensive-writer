// Data for Intensive Writer: Themes, Prompts, Ideas, Structures, and Blocks

const THEMES = ['Education', 'Environment', 'Transportation', 'Technology', 'Health'];

const PROMPTS = [
  { id: 'edu1', theme: 'Education', type: 'Advantages & Disadvantages', title: 'Some universities offer online courses as an alternative to classes delivered on campus. Do the advantages of this form of education outweigh its disadvantages?' },
  { id: 'edu2', theme: 'Education', type: 'Advantages & Disadvantages', title: 'In the past, lectures were the traditional method of teaching large numbers of students in a classroom. Nowadays new technology is increasingly being used to teach students. What are the advantages and disadvantages of this new approach in teaching?' },
  { id: 'edu3', theme: 'Education', type: 'Advantages & Disadvantages', title: 'There are more workers to work from home and more students to study from home. This is because computer technology is becoming more and more easily accessible and cheaper. Do the advantages of working or studying from home outweigh its disadvantages?' },
  { id: 'env1', theme: 'Environment', type: 'Opinion', title: 'Environmental protection is the responsibility of politicians, not individuals, as individuals can do too little. To what extent do you agree or disagree with this opinion?' },
  { id: 'env2', theme: 'Environment', type: 'Opinion', title: 'Solving environmental problems should be the responsibility of international organisations rather than each national government. To what extent do you agree or disagree with this opinion?' },
  { id: 'env3', theme: 'Environment', type: 'Opinion', title: 'Individuals can do nothing to improve the environment; only governments and large companies can make a difference. To what extent do you agree or disagree with this opinion?' },
  { id: 'trans1', theme: 'Transportation', type: 'Opinion - Best/Only', title: 'Some people think that the best way to increase road safety is to increase the minimum age for driving cars or riding motorcycles. To what extent do you agree or disagree?' },
  { id: 'trans2', theme: 'Transportation', type: 'Opinion - Best/Only', title: 'The only way to improve safety on our roads is to give much stricter punishments for driving offenses. To what extent do you agree or disagree?' },
  { id: 'tech1', theme: 'Technology', type: 'Positive or Negative', title: 'Nowadays, people depend on technology in their free time. Is this a positive or negative development?' },
  { id: 'tech2', theme: 'Technology', type: 'Positive or Negative', title: 'Nowadays, the way many people interact with each other has changed because of technology. In what ways has technology affected the types of relationships people make? Has this become a positive or negative development?' },
  { id: 'health1', theme: 'Health', type: 'Opinion', title: 'It is more important to spend public money promoting a healthy lifestyle in order to prevent illness than to spend it on the treatment of people who are already ill. To what extent do you agree or disagree with this opinion?' },
  { id: 'health2', theme: 'Health', type: 'Opinion', title: 'People believe that the government should provide free healthcare to citizens. To what extent do you agree or disagree?' }
];

const IDEAS = {
  edu1: [
    { id: 'a1', side: 'body1', text: 'More cost-effective than traditional learning', explain: 'Online courses cut down on tuition, commuting, and accommodation costs compared with attending campus.', vocab: ['cost-effective', 'tuition fees', 'financial burden'] },
    { id: 'a2', side: 'body1', text: 'Flexible learning anytime, anywhere', explain: 'Students can study at their own pace and fit lessons around work or family commitments.', vocab: ['flexible schedule', 'self-paced learning', 'convenience'] },
    { id: 'a5', side: 'body1', text: 'Wider access to a variety of courses', explain: 'Online platforms let students enrol in courses not offered by local universities, widening their choices.', vocab: ['wide range of courses', 'course selection', 'unlimited access'] },
    { id: 'a3', side: 'body2', text: 'Lacks practical, hands-on exercises', explain: 'Purely theoretical online lessons give students little chance to practise real skills.', vocab: ['theoretical knowledge', 'practical exercises', 'hands-on training'] },
    { id: 'a4', side: 'body2', text: 'Weaker immediate interaction', explain: 'Without face-to-face contact, students and teachers struggle to communicate and get instant feedback.', vocab: ['immediate feedback', 'face-to-face interaction', 'communication barrier'] },
    { id: 'a6', side: 'body2', text: 'Requires strong self-discipline', explain: 'Without a fixed timetable, students need strong self-motivation to keep up with online lessons.', vocab: ['self-motivation', 'procrastination', 'time management'] }
  ],
  edu2: [
    { id: 'b1', side: 'body1', text: 'Students develop technological skills', explain: 'Using digital tools in class helps students build IT skills useful in modern workplaces.', vocab: ['technological proficiency', 'digital literacy', '21st-century skills'] },
    { id: 'b2', side: 'body1', text: 'Access to high-quality, current information', explain: 'Technology connects students to up-to-date resources far beyond a single textbook.', vocab: ['up-to-date resources', 'high-quality content', 'online database'] },
    { id: 'b5', side: 'body1', text: 'Personalised pace of learning', explain: 'Software can adapt content to each student’s speed, letting quick learners move ahead and slower learners get more support.', vocab: ['personalised learning', 'adaptive software', 'individual pace'] },
    { id: 'b3', side: 'body2', text: 'Distraction from ads and games', explain: 'Devices in the classroom can easily pull students’ attention away from the lesson.', vocab: ['digital distraction', 'off-task behaviour', 'loss of focus'] },
    { id: 'b4', side: 'body2', text: 'Fewer chances to socialise with classmates', explain: 'Screen-based learning reduces the face-to-face interaction that builds social skills.', vocab: ['peer interaction', 'social development', 'classroom engagement'] },
    { id: 'b6', side: 'body2', text: 'High cost of equipment and training', explain: 'Schools must invest heavily in devices and teacher training, which not all of them can afford.', vocab: ['equipment costs', 'teacher training', 'budget constraints'] }
  ],
  edu3: [
    { id: 'c1', side: 'body1', text: 'Greater flexibility in time and location', explain: 'People can work or study whenever and wherever suits them, fitting tasks around personal responsibilities.', vocab: ['flexible arrangement', 'personal responsibilities', 'autonomy'] },
    { id: 'c2', side: 'body1', text: 'Lower financial costs', explain: 'Working or studying from home cuts transport, accommodation, and meal expenses for individuals and institutions alike.', vocab: ['overhead costs', 'commuting expenses', 'cost savings'] },
    { id: 'c5', side: 'body1', text: 'Access to a wider talent pool for employers', explain: 'Companies can recruit skilled workers regardless of location, widening the pool of candidates they can hire from.', vocab: ['global talent pool', 'remote hiring', 'geographic flexibility'] },
    { id: 'c3', side: 'body2', text: 'Reduced social interaction and collaboration', explain: 'Fewer face-to-face exchanges can weaken teamwork and interpersonal skills, and may lead to isolation.', vocab: ['collaboration', 'interpersonal skills', 'isolation'] },
    { id: 'c4', side: 'body2', text: 'Greater distractions and lower productivity', explain: 'Home environments are full of distractions, and without supervision some people struggle to stay disciplined.', vocab: ['home distractions', 'self-discipline', 'productivity loss'] },
    { id: 'c6', side: 'body2', text: 'Unequal access to reliable technology', explain: 'Not everyone has a stable internet connection or a quiet home environment suitable for remote work or study.', vocab: ['unequal access', 'technology gap', 'unstable connection'] }
  ],
  env1: [
    { id: 'd1', side: 'body1', text: 'Governments can implement large-scale policy', explain: 'Politicians have the authority to pass laws, regulate emissions, and invest in green energy at a national scale.', vocab: ['legislative authority', 'emissions regulation', 'green investment'] },
    { id: 'd2', side: 'body1', text: 'Environmental issues need national coordination', explain: 'Problems like carbon reduction or public transport systems require centrally coordinated action.', vocab: ['national coordination', 'carbon reduction targets', 'infrastructure planning'] },
    { id: 'd3', side: 'body1', text: 'Governments can regulate corporate behaviour', explain: 'Only the state has the power to penalise polluting companies and enforce environmental standards.', vocab: ['corporate regulation', 'environmental standards', 'penalise polluters'] },
    { id: 'd4', side: 'body2', text: 'Collective individual actions add up', explain: 'Small everyday choices like recycling or cutting plastic use create meaningful impact when multiplied across millions of people.', vocab: ['collective impact', 'recycling habits', 'conscious consumption'] },
    { id: 'd5', side: 'body2', text: 'Consumers can pressure companies', explain: 'By choosing eco-friendly products, individuals push businesses toward more sustainable practices.', vocab: ['consumer demand', 'eco-friendly products', 'sustainable consumption'] },
    { id: 'd6', side: 'body2', text: 'Citizens influence policy through voting', explain: 'Voting for green policies and raising public awareness can shape a government’s environmental agenda.', vocab: ['voting power', 'public pressure', 'environmental awareness'] }
  ],
  env2: [
    { id: 'e1', side: 'body1', text: 'Environmental issues cross borders', explain: 'Problems such as climate change and ocean pollution do not respect national boundaries and need global solutions.', vocab: ['transboundary issue', 'global pollution', 'cross-border impact'] },
    { id: 'e2', side: 'body1', text: 'International bodies can coordinate agreements', explain: 'Global treaties and multinational cooperation are best organised at an international level.', vocab: ['global treaty', 'multinational cooperation', 'climate agreement'] },
    { id: 'e3', side: 'body1', text: 'They can fund poorer countries', explain: 'International organisations can provide financial aid and technology transfer to developing nations.', vocab: ['financial aid', 'technology transfer', 'sustainable development'] },
    { id: 'e4', side: 'body2', text: 'Policies need strong national implementation', explain: 'Laws must still be enforced and industries monitored at the domestic level to be effective.', vocab: ['law enforcement', 'domestic implementation', 'industry monitoring'] },
    { id: 'e5', side: 'body2', text: 'Countries have different priorities', explain: 'Developing and developed nations face different economic realities that a single global policy cannot address.', vocab: ['economic disparity', 'differing priorities', 'developing nations'] },
    { id: 'e6', side: 'body2', text: 'Weak governments may lack accountability', explain: 'Without strong domestic institutions, international rules can be ignored, as seen with illegal logging or local pollution.', vocab: ['domestic accountability', 'illegal logging', 'weak governance'] }
  ],
  env3: [
    { id: 'f1', side: 'body1', text: 'Companies cause significant pollution', explain: 'Industrial emissions and large-scale manufacturing are major sources of environmental damage.', vocab: ['industrial emissions', 'large-scale manufacturing', 'environmental damage'] },
    { id: 'f2', side: 'body1', text: 'Businesses can develop cleaner technology', explain: 'Companies have the resources to invest in renewable energy and eco-friendly production methods.', vocab: ['renewable energy', 'eco-friendly production', 'clean technology'] },
    { id: 'f3', side: 'body1', text: 'Governments can regulate industry', explain: 'Green policies and environmental regulations can push industries toward sustainable infrastructure.', vocab: ['green policy', 'environmental regulation', 'sustainable infrastructure'] },
    { id: 'f4', side: 'body2', text: 'Small individual actions add up', explain: 'Reducing waste, saving energy, and using public transport create a large collective effect.', vocab: ['waste reduction', 'energy conservation', 'collective effect'] },
    { id: 'f5', side: 'body2', text: 'Consumers influence corporations', explain: 'Purchasing choices, including boycotts, can pressure companies to change harmful practices.', vocab: ['purchasing power', 'boycott', 'sustainable brands'] },
    { id: 'f6', side: 'body2', text: 'Public awareness pressures leaders', explain: 'Social media activism and environmental movements can push politicians to take action.', vocab: ['social media activism', 'environmental movement', 'public pressure'] }
  ],
  trans1: [
    { id: 'g1', side: 'body1', text: 'Mature drivers are more careful', explain: 'Older, more experienced drivers tend to make safer decisions on the road.', vocab: ['mature judgement', 'cautious driving', 'risk awareness'] },
    { id: 'g2', side: 'body1', text: 'More time to develop driving skills', explain: 'A higher minimum age gives young people longer to practise and sharpen their driving ability.', vocab: ['driving proficiency', 'skill development', 'practice time'] },
    { id: 'g3', side: 'body2', text: 'Stricter driving tests', explain: 'Making tests harder ensures only genuinely competent drivers are licensed, regardless of age.', vocab: ['rigorous testing', 'licensing standards', 'competent drivers'] },
    { id: 'g4', side: 'body2', text: 'Better road infrastructure', explain: 'Clear road signs and speed cameras can reduce accidents more directly than an age limit.', vocab: ['road infrastructure', 'speed cameras', 'traffic signage'] },
    { id: 'g5', side: 'body2', text: 'Stricter punishments for offenders', explain: 'Heavier fines or prison sentences can deter dangerous driving at any age.', vocab: ['stringent penalties', 'deterrent effect', 'traffic offences'] },
    { id: 'g6', side: 'body2', text: 'Encourage public transport use', explain: 'Reducing the number of young drivers on the road by promoting buses and trains lowers overall risk.', vocab: ['public transport', 'reduced car dependency', 'safer alternatives'] }
  ],
  trans2: [
    { id: 'h1', side: 'body1', text: 'Punishment acts as a deterrent', explain: 'Knowing that penalties are severe discourages drivers from repeating dangerous behaviour.', vocab: ['deterrent effect', 'repeat offenders', 'stringent punishment'] },
    { id: 'h2', side: 'body1', text: 'Consistent enforcement makes punishment credible', explain: 'Strict laws only work if they are applied reliably, so visible policing reinforces the deterrent.', vocab: ['consistent enforcement', 'credible threat', 'policing presence'] },
    { id: 'h5', side: 'body1', text: 'Sets a clear moral standard', explain: 'Strict laws communicate that dangerous driving is unacceptable, gradually shaping public attitudes.', vocab: ['moral standard', 'public attitude', 'social norm'] },
    { id: 'h3', side: 'body2', text: 'Improved road infrastructure', explain: 'Better signs, lighting, and road design prevent accidents that punishment alone cannot address.', vocab: ['road design', 'infrastructure investment', 'accident prevention'] },
    { id: 'h4', side: 'body2', text: 'Encourage public transport use', explain: 'Fewer cars on the road, achieved by promoting buses and trains, reduces the chances of dangerous driving altogether.', vocab: ['modal shift', 'public transport investment', 'reduced congestion'] },
    { id: 'h6', side: 'body2', text: 'Driver education programmes', explain: 'Teaching safe driving habits from an early age addresses the root cause rather than only punishing after the fact.', vocab: ['driver education', 'root cause', 'early intervention'] }
  ],
  tech1: [
    { id: 'j1', side: 'body1', text: 'Convenient access to entertainment', explain: 'Streaming services and online games offer instant, personalised entertainment whenever people want it.', vocab: ['on-demand entertainment', 'personalised content', 'streaming services'] },
    { id: 'j2', side: 'body1', text: 'Flexible leisure regardless of time/place', explain: 'Mobile devices let people enjoy entertainment wherever and whenever suits them.', vocab: ['on-the-go access', 'mobile devices', 'flexible leisure'] },
    { id: 'j3', side: 'body1', text: 'Access to diverse hobbies and interests', explain: 'Online platforms let people explore learning, gaming, or creative communities they might never encounter offline.', vocab: ['diverse interests', 'online communities', 'creative content'] },
    { id: 'j4', side: 'body2', text: 'Encourages a sedentary lifestyle', explain: 'Screen-based leisure reduces physical activity, contributing to health problems.', vocab: ['sedentary lifestyle', 'physical inactivity', 'health risks'] },
    { id: 'j5', side: 'body2', text: 'Can lead to addictive behaviour', explain: 'Passive digital consumption often causes excessive screen time and loss of control over one’s schedule.', vocab: ['excessive screen time', 'addictive behaviour', 'loss of control'] },
    { id: 'j6', side: 'body2', text: 'Reduces real-life social interaction', explain: 'Heavy technology use can mean fewer outdoor activities and face-to-face gatherings.', vocab: ['reduced social interaction', 'face-to-face gathering', 'outdoor activity'] }
  ],
  tech2: [
    { id: 'k1', side: 'body1', text: 'Friendships regardless of distance', explain: 'Online platforms let people build and maintain relationships across huge distances.', vocab: ['virtual community', 'global connection', 'long-distance friendship'] },
    { id: 'k2', side: 'body1', text: 'Easier to maintain long-distance relationships', explain: 'Instant messaging and video calls keep people connected despite being physically apart.', vocab: ['instant messaging', 'video calls', 'staying connected'] },
    { id: 'k3', side: 'body1', text: 'Connecting over shared interests', explain: 'Forums and hobby groups let individuals meet like-minded people they would never encounter locally.', vocab: ['online forum', 'hobby group', 'like-minded people'] },
    { id: 'k4', side: 'body2', text: 'Lacks emotional depth', explain: 'Online interaction often misses non-verbal cues like body language and tone of voice.', vocab: ['non-verbal cues', 'emotional depth', 'body language'] },
    { id: 'k5', side: 'body2', text: 'Weakens face-to-face relationships', explain: 'Heavy reliance on digital communication may reduce social skills and weaken emotional bonds.', vocab: ['declining social skills', 'emotional bonds', 'face-to-face interaction'] },
    { id: 'k6', side: 'body2', text: 'Creates psychological pressure', explain: 'Social media exposure can trigger unrealistic comparisons, loneliness, and anxiety.', vocab: ['unrealistic comparison', 'FOMO', 'social media pressure'] }
  ],
  health1: [
    { id: 'l1', side: 'body1', text: 'Many diseases cannot be cured', explain: 'For some illnesses, treatment can only manage symptoms rather than offer a full cure, making prevention more valuable.', vocab: ['incurable disease', 'symptom management', 'chronic illness'] },
    { id: 'l2', side: 'body1', text: 'Many diseases can be prevented', explain: 'Healthy habits like diet and exercise can stop illnesses such as heart disease before they develop.', vocab: ['preventive healthcare', 'healthy habits', 'risk reduction'] },
    { id: 'l5', side: 'body1', text: 'Prevention reduces long-term healthcare costs', explain: 'Investing in healthy lifestyles now can lower future spending on expensive treatments.', vocab: ['long-term savings', 'cost-effective', 'preventive investment'] },
    { id: 'l3', side: 'body2', text: 'Some diseases cannot be prevented', explain: 'Inherited or genetic diseases occur regardless of lifestyle, so treatment funding remains essential.', vocab: ['inherited disease', 'genetic condition', 'unavoidable illness'] },
    { id: 'l4', side: 'body2', text: 'Existing patients still need care', explain: 'People who are already ill require ongoing medical treatment that cannot simply be replaced by prevention campaigns.', vocab: ['ongoing treatment', 'medical care', 'patient welfare'] },
    { id: 'l6', side: 'body2', text: 'Urgent cases require immediate treatment', explain: 'Emergency and critical patients cannot wait for prevention programmes to take effect.', vocab: ['emergency care', 'immediate treatment', 'critical condition'] }
  ],
  health2: [
    { id: 'm1', side: 'body1', text: 'Increases access to healthcare', explain: 'Free healthcare ensures that even low-income citizens can receive medical treatment when needed.', vocab: ['universal access', 'low-income citizens', 'medical treatment'] },
    { id: 'm2', side: 'body1', text: 'Reduces spread of contagious diseases', explain: 'When treatment is free, people are more likely to seek help early, limiting outbreaks.', vocab: ['contagious disease', 'early intervention', 'public health'] },
    { id: 'm5', side: 'body1', text: 'Reduces financial stress for families', explain: 'Families no longer need to fear falling into debt because of unexpected medical bills.', vocab: ['financial stress', 'medical bills', 'economic security'] },
    { id: 'm3', side: 'body2', text: 'Creates a financial burden on government', explain: 'Funding free healthcare for an entire population requires enormous public spending.', vocab: ['public spending', 'financial burden', 'tax-funded system'] },
    { id: 'm4', side: 'body2', text: 'May overload hospitals', explain: 'Without cost as a barrier, demand can outstrip supply, leading to longer waits and lower-quality care.', vocab: ['hospital overload', 'longer wait times', 'quality of care'] },
    { id: 'm6', side: 'body2', text: 'May reduce quality of private care options', explain: 'Overreliance on a single free system can weaken incentives to maintain diverse, competitive healthcare providers.', vocab: ['quality of care', 'competitive market', 'healthcare providers'] }
  ]
};

const STRUCTURES = {
  intro: [
    'It is often argued that ___. This essay will discuss both sides before reaching a conclusion.',
    'While some believe ___, others contend that ___.',
    'There is a growing debate over whether ___.',
    'This essay will examine both perspectives and argue that ___.'
  ],
  body: [
    'Firstly, / One of the primary reasons is that ___.',
    'This is because ___.',
    'For instance, / A clear example of this is ___.',
    'Moreover, / In addition, ___.',
    'As a result, / Consequently, ___.'
  ],
  conclusion: [
    'In conclusion, / To conclude, ___.',
    'Overall, it can be seen that ___.',
    'Taking everything into account, ___.',
    'For the reasons outlined above, I believe that ___.'
  ]
};

const BLOCKS = [
  { key: 'intro', label: 'Mở bài (Introduction)', struct: 'intro', minWords: 35, targetWords: '40 - 55 từ' },
  { key: 'body1', label: 'Thân bài 1 (Body 1)', struct: 'body', minWords: 80, targetWords: '90 - 110 từ' },
  { key: 'body2', label: 'Thân bài 2 (Body 2)', struct: 'body', minWords: 80, targetWords: '90 - 110 từ' },
  { key: 'conclusion', label: 'Kết bài (Conclusion)', struct: 'conclusion', minWords: 30, targetWords: '35 - 50 từ' }
];
