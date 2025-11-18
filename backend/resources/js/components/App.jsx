import React from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import StockAttributeImporter from './Test';

export default function App() {
    return (
        <div>
            <Routes>
                <Route path="/stocks" element={<StockAttributeImporter />} />
            </Routes>
        </div>
    );
}