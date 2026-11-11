wrokspace => global level overall apps 

lerna initialization :
commmands : 
first  npm init --y  iside the root 

pnpm add -Dw lerna 
 pnpm approve-builds
 npx lerna  init 
 // create the  scripts in pkg.json 
 pnpm create vite apps/customerPortal --template react-ts 

then : runnnings 
 pnpm --filter customerportal dev 

 name is from the  package.json should  match so that  the  pnpn workspace  is able to  understand 

config  the  tsconfigs for the  packages 

installing  a  pkg  inside the  app 

pnpm add @fe_standard/ui@workspace:* --filter customerportal 

created  the packages\eslint-config 
now to install in the  workspace 

pnpm add @fe_standard/eslint-config@workspace:* --filter customerportal     

inside apps\customerPortal\eslint.config.js

import   the  react config   const exported


// local sonar qb  setup : 
