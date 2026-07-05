import { Routes, Route } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import AppBar from './components/AppBar.jsx'
import BottomNav from './components/BottomNav.jsx'
import Login from './screens/Login.jsx'
import Home from './screens/Home.jsx'
import Inventory from './screens/Inventory.jsx'
import CountStock from './screens/CountStock.jsx'
import WasteLog from './screens/WasteLog.jsx'
import Recipes from './screens/Recipes.jsx'
import RecipeDetail from './screens/RecipeDetail.jsx'
import RecipeEdit from './screens/RecipeEdit.jsx'
import RecipeIngredientsEdit from './screens/RecipeIngredientsEdit.jsx'
import Approvals from './screens/Approvals.jsx'
import Purchases from './screens/Purchases.jsx'
import Suppliers from './screens/Suppliers.jsx'
import Activity from './screens/Activity.jsx'
import More from './screens/More.jsx'
import Settings from './screens/Settings.jsx'
import ManageStaff from './screens/ManageStaff.jsx'
import Placeholder from './screens/Placeholder.jsx'

export default function App() {
  const { currentUser, loadState } = useAuth()

  // Wait for the user list before deciding — otherwise a saved session
  // briefly looks logged-out and flashes the login screen.
  if (loadState === 'loading') {
    return <div className="splash">Tanawin Kitchen…</div>
  }

  if (!currentUser) {
    return <Login />
  }

  return (
    <div className="app">
      <AppBar />
      <main className="screen">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/count" element={<CountStock />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/recipes/:id" element={<RecipeDetail />} />
          <Route path="/recipes/:id/edit" element={<RecipeEdit />} />
          <Route path="/recipes/:id/ingredients" element={<RecipeIngredientsEdit />} />
          <Route path="/purchases" element={<Purchases />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/waste" element={<WasteLog />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/more" element={<More />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/staff" element={<ManageStaff />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="*" element={<Placeholder title="Not found" />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
