import { BrowserRouter, Routes, Route } from 'react-router-dom';
import EndpointList from './pages/EndpointList';
import EndpointDetail from './pages/EndpointDetail';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <Routes>
          <Route path="/" element={<EndpointList />} />
          <Route path="/endpoints/:id" element={<EndpointDetail />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
