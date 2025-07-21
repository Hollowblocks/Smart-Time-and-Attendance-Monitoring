import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router-dom'
import LiveFeed from './Components/LiveFeed.tsx'
import Timelog from './Components/Timelog.tsx'
import React from 'react'
import FaceRecognition from './Components/facerecog.tsx'
import Login from "./Components/Login"
import Personnel from './Components/personnel.tsx'

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />
  },
  {
    path: "personnel",
    element: <Personnel />
  },
  {
    path: "livefeed",
    element: <LiveFeed />
  },
  {
    path: "timelog",
    element: <Timelog />
  },
  {
    path: "facerecog",
    element: <FaceRecognition />
  },
  {
    path: "login",
    element: <Login />
  }
], {
  basename: '/stamp'
})

createRoot(document.getElementById('root')!).render(
  <RouterProvider router={router} />
)
