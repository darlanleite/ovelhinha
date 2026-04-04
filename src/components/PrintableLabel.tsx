import React from 'react';
import QRCode from 'react-qr-code';

interface PrintableLabelProps {
  childName: string;
  braceletNumber: string;
  roomId: string; // we can use it to fetch room emoji
  roomEmoji?: string;
  childId: string;
}

const PrintableLabel: React.FC<PrintableLabelProps> = ({ childName, braceletNumber, roomEmoji, childId }) => {
  return (
    <div className="hidden print:flex flex-col items-center justify-center w-full h-[100vh] bg-white gap-4 text-black">
      {/* 
        This is a simple tag designed for a generic printer or thermal printer 
        Styling optimized for printing: high contrast, simple layout.
      */}
      <div className="text-center w-[60mm] p-2 border-2 border-black rounded-lg">
        <h1 className="text-2xl font-black mb-1">{childName}</h1>
        <div className="flex justify-center items-center gap-2 mb-2">
          <span className="text-3xl">🐑</span>
          <span className="text-lg font-bold">{roomEmoji} Sala</span>
        </div>
        
        <div className="flex justify-center my-4">
          <QRCode
            value={childId}
            size={128}
            level="H"
          />
        </div>
        
        <div className="font-mono text-4xl font-extrabold mt-2 border-t-2 border-black pt-2">
          #{braceletNumber}
        </div>
        <p className="text-xs mt-1">Ovelhinha Kids</p>
      </div>
    </div>
  );
};

export default PrintableLabel;
