import { useState } from 'react'
import './App.css'
import Messenger from './Component/Messenger'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Login from './Component/Account/Login'
import Sidebar from './Component/Side_Bar_&Chat Area/Sidebar'
import Protected from "./Component/Protected"



function App() {

  const router = createBrowserRouter([
    {
      path: "/",
      element: <Messenger />, // login page
    },
    {
      path: "/chats",
      element: (
        <Protected>
          <Sidebar />
        </Protected>
      ),
    },
  ]);

  // const router = createBrowserRouter([
  //   {
  //     path: "/",
  //     element: <Messenger />
  //   },
  //   {
  //     path: "/chats",
  //     element: <Sidebar />
  //   },

  // ])

  return (
    <>
      <RouterProvider router={router} />

    </>

  )
}

export default App
