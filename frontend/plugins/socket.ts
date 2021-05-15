import Vue from 'vue'
import { Plugin } from '@nuxt/types'

import io from 'socket.io-client'
import VueSocketIOExt from 'vue-socket.io-extended'

const socket = io('http://localhost:3000/', {
  path: '/api/socket.io',
  autoConnect: false,
})

const plugin: Plugin = ({ store }) => {
  socket.onAny((event, ...args) => {
    console.log(`got ${event}:`, args.join(', '))
  })

  let retried = false

  socket.on('connect', () => {
    retried = false
  })

  socket.on('connect_error', async (err) => {
    if (!store.state.auth.refreshToken) {
      return
    }

    if (err.message === 'invalid token' && !retried) {
      retried = true

      try {
        await store.dispatch('auth/refreshTokens')

        socket.open()
      } catch (error) {
        console.error('Could not refresh token for the websocket', error)
      }
    }
  })

  store.watch(
    (state) => state.auth.accessToken,
    (accessToken) => {
      socket.auth = {
        accessToken,
      }
    },
    {
      immediate: true,
    }
  )

  Vue.use(VueSocketIOExt, socket, { store })

  store.watch(
    (_state, getters) => getters['auth/isAuthenticated'],
    (val) => {
      if (val) {
        socket.open()
      } else {
        socket.close()
      }
    },
    {
      immediate: true,
    }
  )
}

export default plugin