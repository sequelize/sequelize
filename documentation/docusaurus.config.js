// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

const siteTitle = 'Sequelize v7 (alpha)';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: siteTitle,
  tagline: 'Promise-based ORM',
  url: 'https://sequelize.org',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  organizationName: 'sequelize',
  projectName: 'sequelize',

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          editUrl: 'https://github.com/sequelize/sequelize/tree/main/documentation/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],

  themeConfig:
  /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    {
      navbar: {
        title: siteTitle,
        logo: {
          alt: 'Sequelize Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'doc',
            docId: 'intro',
            position: 'left',
            label: 'Guides',
          },
          {
            href: '/api/',
            position: 'left',
            label: 'API Reference',
            target: '_blank',
          },
          { href: 'https://sequelize-slack.herokuapp.com/', label: 'Slack', position: 'right' },
          {
            href: 'https://github.com/sequelize/sequelize',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Tutorial',
                to: '/docs/intro',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Stack Overflow',
                href: 'https://stackoverflow.com/questions/tagged/sequelize.js',
              },
              {
                label: 'Slack',
                href: 'https://sequelize-slack.herokuapp.com/',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/SequelizeJS',
              },
            ],
          },
          {
            title: 'More',
            items: [
              // {
              //   label: 'Blog',
              //   to: '/blog',
              // },
              {
                label: 'GitHub',
                href: 'https://github.com/sequelize/sequelize',
              },
              {
                label: 'Changelog',
                href: 'https://github.com/sequelize/sequelize/releases',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Sequelize Contributors. Built with Docusaurus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    },
};

module.exports = config;
