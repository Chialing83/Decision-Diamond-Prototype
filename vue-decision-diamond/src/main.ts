import './styles.css';
import { createApp } from 'vue';
import { createRouter, createWebHashHistory, RouterLink } from 'vue-router';
import App from './App.vue';
import HomePage from './home/HomePage.vue';
import ContactsPage from './contacts/ContactsPage.vue';
import ContactDetails from './contacts/ContactDetails.vue';
import AutomationsPage from './automations/AutomationsPage.vue';
import AutomationsIndexPage from './automations/AutomationsIndexPage.vue';
import AutomationTemplatesPage from './automations/AutomationTemplatesPage.vue';
import AutomationBuilder from './automations/builder/AutomationBuilder.vue';
import { createDex, createRouterAdapter } from '@thryvlabs/dex-vue';

const routes = [
  // NOTE: Home and Contacts are temporarily blocked from end users while we
  // focus the prototype on the Automation builder flow. The route definitions
  // and components are kept in the build (see `meta.blocked`) so we can
  // re-enable them quickly by removing the navigation guard below.
  { path: '/', component: HomePage, meta: { blocked: true } },
  {
    path: '/contacts',
    component: ContactsPage,
    meta: { blocked: true },
    children: [{ path: 'contact/:id', component: ContactDetails }],
  },
  {
    path: '/automations',
    component: AutomationsPage,
    children: [
      { path: '', component: AutomationsIndexPage },
      {
        path: 'templates',
        component: AutomationTemplatesPage,
        meta: { fullscreen: true },
      },
      {
        path: 'builder/:id',
        component: AutomationBuilder,
        meta: { fullscreen: true },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// Block direct-URL access to any route flagged `meta.blocked`. All
// `/automations/*` routes (including the builder) remain accessible.
router.beforeEach((to) => {
  if (to.matched.some((record) => record.meta?.blocked)) {
    return { path: '/automations' };
  }
  return true;
});

const routerAdapter = createRouterAdapter({
  adapter: { Link: RouterLink },
});

const dex = createDex();

const app = createApp(App);
app.use(router);
app.use(routerAdapter);
app.use(dex);

app.mount('#root');
