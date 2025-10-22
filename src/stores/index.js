import { createPinia } from 'pinia'
import { useConfigStore } from './modules/config'
import { useElmentAttrStore } from './modules/element'
const pinia = createPinia()
export {
  pinia,
  useConfigStore,
  useElmentAttrStore
}
