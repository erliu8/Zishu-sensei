import React from 'react';

export interface CalendarProps {
  value?: Date;
  onChange?: (date: Date) => void;
}

/**
 * 日历组件
 */
const Calendar: React.FC<CalendarProps> = ({ value = new Date() }) => {
  return (
    <div className="calendar">
      <div className="calendar-header">
        <h3>{value.toLocaleDateString()}</h3>
      </div>
      <div className="calendar-body">
        {/* 日历内容 */}
      </div>
    </div>
  );
};

export default Calendar;

