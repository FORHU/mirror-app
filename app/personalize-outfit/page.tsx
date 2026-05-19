"use client";

import { useState } from 'react';
import { Calendar, MapPin, Sparkles } from 'lucide-react';
import "../../styles/glow.css";

export default function PersonalizeOutfit() {
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [location, setLocation] = useState('');
    const [eventType, setEventType] = useState('');

    return (
        <>

            <div
                className="flex items-center justify-center bg-black"
                style={{ width: '768px', height: '1366px' }}
            >
                {/* Card */}
                <div style={{
                    width: '560px',
                    background: 'rgba(14,14,22,0.97)',
                    borderRadius: '22px',
                    padding: '52px 44px',
                    border: '1px solid rgba(110, 70, 240, 0.35)',
                    boxShadow: `
                        0 0 30px rgba(110, 70, 240, 0.35),
                        0 0 70px rgba(90, 50, 210, 0.2),
                        0 0 120px rgba(70, 30, 180, 0.1)
                    `,
                }}>
                    {/* Header */}
                    <div className="text-center" style={{ marginBottom: '40px' }}>
                        <h1 style={{ color: 'white', fontSize: '26px', fontWeight: '700', marginBottom: '10px', letterSpacing: '-0.3px' }}>
                            Personalize Your Look
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px' }}>
                            Tell us about your event
                        </p>
                    </div>

                    {/* When */}
                    <div style={{ marginBottom: '28px' }}>
                        <label className="flex items-center gap-2" style={{ color: 'white', fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                            <Calendar size={16} color="white" />
                            When is the event?
                        </label>
                        <div className="flex gap-3">
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="pz-input"
                                style={{ flex: 1 }}
                            />
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="pz-input"
                                style={{ flex: 1 }}
                            />
                        </div>
                    </div>

                    {/* Where */}
                    <div style={{ marginBottom: '28px' }}>
                        <label className="flex items-center gap-2" style={{ color: 'white', fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                            <MapPin size={16} color="white" />
                            Where is the event?
                        </label>
                        <input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="Enter location"
                            className="pz-input"
                        />
                    </div>

                    {/* What */}
                    <div style={{ marginBottom: '44px' }}>
                        <label className="flex items-center gap-2" style={{ color: 'white', fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                            <Sparkles size={16} color="white" />
                            What is the event?
                        </label>
                        <select
                            value={eventType}
                            onChange={(e) => setEventType(e.target.value)}
                            className="pz-select"
                        >
                            <option value="" disabled>Select event type</option>
                            <option value="wedding">Wedding</option>
                            <option value="party">Party</option>
                            <option value="business">Business</option>
                            <option value="casual">Casual</option>
                            <option value="formal">Formal</option>
                            <option value="birthday">Birthday</option>
                            <option value="date">Date Night</option>
                        </select>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-4">
                        <button className="pz-btn-skip">Skip</button>
                        <button className="pz-btn-continue">Continue</button>
                    </div>
                </div>
            </div>
        </>
    );
}
