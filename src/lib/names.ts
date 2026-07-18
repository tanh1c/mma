export const firstNames = [
  'Jack', 'Thomas', 'Michael', 'Alex', 'David', 'James', 'John', 'Robert', 'William', 'Richard',
  'Charles', 'Joseph', 'Chris', 'Daniel', 'Paul', 'Mark', 'Donald', 'George', 'Kenneth', 'Steven',
  'Edward', 'Brian', 'Ronald', 'Anthony', 'Kevin', 'Jason', 'Matthew', 'Gary', 'Timothy', 'Jose',
  'Larry', 'Jeffrey', 'Frank', 'Scott', 'Eric', 'Stephen', 'Andrew', 'Raymond', 'Gregory', 'Joshua',
  'Jerry', 'Dennis', 'Walter', 'Patrick', 'Peter', 'Harold', 'Douglas', 'Henry', 'Carl', 'Arthur',
  'Ryan', 'Roger', 'Joe', 'Juan', 'Albert', 'Jonathan', 'Justin', 'Terry', 'Gerald', 'Keith',
  'Samuel', 'Willie', 'Ralph', 'Lawrence', 'Nicholas', 'Roy', 'Ben', 'Bruce', 'Brandon', 'Adam',
  'Ivan', 'Igor', 'Vladimir', 'Dmitry', 'Viktor', 'Artem', 'Maxim', 'Roman', 'Andrei', 'Sergei',
  'Tatsuya', 'Kenji', 'Shoji', 'Kazuki', 'Naoki', 'Hiroshi', 'Thiago', 'Lucas', 'Mateus', 'Felipe',
  'Junior', 'Gabriel', 'Diego', 'Rodrigo', 'Bruno', 'Marcelo', 'Gustavo', 'Rafael', 'Leonardo', 'Eduardo'
];

export const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes',
  'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa',
  'Ivanov', 'Smirnov', 'Kuznetsov', 'Popov', 'Sokolov', 'Lebedev', 'Kozlov', 'Novikov', 'Morozov', 'Petrov',
  'Volkov', 'Solovyov', 'Vasilyev', 'Zaytsev', 'Pavlov', 'Semenov', 'Golubev', 'Vinogradov', 'Bogdanov', 'Vorobyov',
  'Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato'
];

export const nicknames = [
  'Iron', 'The Gargoyle', 'The Anomaly', 'The Assassin', 'The Cerberus', 'The Machine', 'The Phantom', 'The Ghost',
  'The Hammer', 'The Viper', 'The Cobra', 'The Python', 'The Jackal', 'The Hyena', 'The Lion', 'The Tiger',
  'The Panther', 'The Leopard', 'The Cheetah', 'The Gorilla', 'The Silverback', 'The Bear', 'The Wolf',
  'The Fox', 'The Bull', 'The Rhino', 'The Hawk', 'The Falcon', 'The Eagle', 'The Owl',
  'The Raven', 'The Crow', 'The Shark', 'The Orca', 'The Kraken', 'The Leviathan', 'The Dragon',
  'The Titan', 'The Colossus', 'The Juggernaut', 'The Gladiator', 'The Spartan', 'The Samurai', 'The Ninja',
  'The Ronin', 'The Viking', 'The Knight', 'The Paladin', 'The Warlord', 'The Warlock', 'The Sorcerer',
  'The Magician', 'The Wizard', 'The Illusionist', 'The Alchemist', 'The Scientist', 'The Professor', 'The Doctor',
  'The Surgeon', 'The Butcher', 'The Executioner', 'The Punisher', 'The Enforcer', 'The Bouncer', 'The Bodyguard',
  'The Mercenary', 'The Hunter', 'The Tracker', 'The Scout', 'The Ranger', 'The Sniper', 'The Marksman'
];

export const nationalities = [
  'USA', 'Brazil', 'Russia', 'Japan', 'Mexico', 'UK', 'Australia', 'Canada', 'France', 'Poland',
  'Sweden', 'Netherlands', 'South Korea', 'China', 'Nigeria', 'New Zealand', 'Ireland', 'Spain', 'Germany', 'Italy'
] as const;

type Nationality = typeof nationalities[number];

const latinName = /^\p{Script=Latin}[\p{Script=Latin}\p{Mark}]*(?:[ '’\-]\p{Script=Latin}[\p{Script=Latin}\p{Mark}]*)*$/u;

export const isLatinFighterName = (name: string) => latinName.test(name);

const romanizedNamePools = {
  Russia: {
    firstNames: ['Aleksandr', 'Aleksei', 'Andrei', 'Artem', 'Dmitri', 'Evgeni', 'Igor', 'Ivan', 'Maksim', 'Mikhail', 'Nikolai', 'Pavel', 'Roman', 'Sergei', 'Viktor', 'Vladimir'],
    lastNames: ['Ivanov', 'Smirnov', 'Kuznetsov', 'Popov', 'Sokolov', 'Lebedev', 'Kozlov', 'Novikov', 'Morozov', 'Petrov', 'Volkov', 'Solovyov', 'Vasilyev', 'Zaitsev', 'Pavlov', 'Semenov']
  },
  Japan: {
    firstNames: ['Akira', 'Haruto', 'Ren', 'Kaito', 'Daichi', 'Hiroshi', 'Kenji', 'Takumi', 'Yuki', 'Sota', 'Riku', 'Naoki', 'Tatsuya', 'Kazuki', 'Shota', 'Yuji'],
    lastNames: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato', 'Yoshida', 'Yamada', 'Sasaki', 'Yamaguchi', 'Matsumoto', 'Inoue']
  },
  'South Korea': {
    firstNames: ['Min-jun', 'Seo-jun', 'Ji-hoon', 'Hyun-woo', 'Jun-seo', 'Dong-hyun', 'Tae-hyun', 'Sung-min', 'Jae-won', 'Woo-jin', 'Young-ho', 'Jin-woo', 'Min-ho', 'Seung-hyun', 'Joon-ho', 'Kyung-soo'],
    lastNames: ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Lim', 'Han', 'Shin', 'Seo', 'Kwon', 'Hwang', 'Ahn']
  },
  China: {
    firstNames: ['Wei', 'Jun', 'Hao', 'Jian', 'Ming', 'Lei', 'Tao', 'Kai', 'Bo', 'Cheng', 'Peng', 'Qiang', 'Yong', 'Bin', 'Long', 'Rui'],
    lastNames: ['Zhang', 'Wang', 'Li', 'Zhao', 'Chen', 'Liu', 'Yang', 'Huang', 'Wu', 'Zhou', 'Xu', 'Sun', 'Ma', 'Zhu', 'Hu', 'Guo']
  }
} as const;

export function getLocalizedFighterName(nationality: string, seed: number) {
  const romanized = romanizedNamePools[nationality as keyof typeof romanizedNamePools];
  if (romanized) {
    const index = Math.abs(seed);
    return {
      firstName: romanized.firstNames[index % romanized.firstNames.length],
      lastName: romanized.lastNames[Math.floor(index / romanized.firstNames.length) % romanized.lastNames.length]
    };
  }

  const index = Math.abs(seed);
  return {
    firstName: firstNames[index % firstNames.length],
    lastName: lastNames[index % lastNames.length]
  };
}
