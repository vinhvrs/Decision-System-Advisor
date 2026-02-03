'use client';

import React from 'react';

const MarketOverviewPage = () => {
    const marketData = [
        { id: 1, name: 'Stock A', price: 120.5, change: '+1.5%' },
        { id: 2, name: 'Stock B', price: 98.3, change: '-0.8%' },
        { id: 3, name: 'Stock C', price: 45.7, change: '+0.3%' },
        { id: 4, name: 'Stock D', price: 210.0, change: '-1.2%' },
    ];

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h1>Market Overview</h1>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                <thead>
                    <tr>
                        <th style={{ borderBottom: '2px solid #ccc', textAlign: 'left', padding: '10px' }}>Name</th>
                        <th style={{ borderBottom: '2px solid #ccc', textAlign: 'right', padding: '10px' }}>Price</th>
                        <th style={{ borderBottom: '2px solid #ccc', textAlign: 'right', padding: '10px' }}>Change</th>
                    </tr>
                </thead>
                <tbody>
                    {marketData.map((item) => (
                        <tr key={item.id}>
                            <td style={{ borderBottom: '1px solid #eee', padding: '10px' }}>{item.name}</td>
                            <td style={{ borderBottom: '1px solid #eee', textAlign: 'right', padding: '10px' }}>${item.price.toFixed(2)}</td>
                            <td style={{ borderBottom: '1px solid #eee', textAlign: 'right', padding: '10px', color: item.change.startsWith('+') ? 'green' : 'red' }}>
                                {item.change}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default MarketOverviewPage;