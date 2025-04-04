import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import Error_404 from './Components/Error_404.tsx'
import SignIn from './Components/SignIn.tsx'
import SignUp from './Components/SignUp.tsx'
import Home from './Components/Home.tsx'
import ProfileCreation from './Components/ProfileCreation.tsx'
import HabitManager from './Components/HabitManager.tsx'
import Reports from './Components/Reports.tsx'
import Layout from './Components/Layout.tsx'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <Error_404/>,
    children: [
      {
        index: true,
        element: <Home/>
      },
      {
        path: '/manager',
        element: <HabitManager/>
      },
      {
        path: '/reports',
        element: <Reports/>
      },
      {
        path: '/profile',
        element: <ProfileCreation/>
      }
    ]
  },
  {
    path: '/signin',
    element: <SignIn/>
  },
  {
    path: '/signup',
    element: <SignUp/>
  }
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router}/>
  </StrictMode>,
)
