# `kyleRatti.ts`

```typescript
const about = {
  name: "Kyle Ratti",
  location: "Maryland",
  intro: "Building something cool for you to use!",
};

const skills = {
  languages: [
    "TypeScript",
    "HTML/CSS/JavaScript",
    "PowerShell",
    "C#",
    "Lua",
    "Java",
  ],
  databases: ["MySQL", "SQLite"],
  operatingSystems: {
    server: ["Windows Server", "Ubuntu Server"],
    desktop: ["Windows", "Ubuntu", "macOS"],
  },
  tools: ["GitHub Actions", "Docker", "Hyper-V", "VSCode"],
};

const hobbies = [
  "Biking",
  "Cars",
  "Gaming",
  "Homelab",
  "Photography",
  "Programming",
  "RC Cars",
];

export const kyleRatti = {
  about: { ...about },
  skills: { ...skills },
  hobbies: { ...hobbies },
};
```
