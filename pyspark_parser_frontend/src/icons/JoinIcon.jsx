// src/icons/JoinIcon.js
import React from 'react';

const JoinIcon = ({ type = 'inner', size = 23 }) => {
  const isLeftDark = ['left', 'inner'].includes(type);
  const isRightDark = ['right', 'inner'].includes(type);

  const fillLeft = isLeftDark ? '#333' : '#ccc';
  const fillRight = isRightDark ? '#333' : '#ccc';

  return (
    <svg width={size} height={size} viewBox="0 0 40 20">
      <circle cx="12" cy="10" r="8" fill={fillLeft} />
      <circle cx="24" cy="10" r="8" fill={fillRight} />
    </svg>
  );
};

export default JoinIcon;
