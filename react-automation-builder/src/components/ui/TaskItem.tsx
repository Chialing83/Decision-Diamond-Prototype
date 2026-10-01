import React from 'react'
import { DexCheckbox } from '@thryvlabs/dex-react'
import { Task } from '../../data/mockData'
import { useStore } from '../../store/useStore'

interface Props {
  task: Task
}

export default function TaskItem({ task }: Props) {
  const { doneTasks, toggleTask } = useStore()
  const isDone = doneTasks.has(task.id)

  return (
    <div
      className="flex items-center gap-3"
      style={{
        padding: '10px 0',
        borderBottom: '1px solid #F0F0F0',
        opacity: isDone ? 0.5 : 1,
      }}
    >
      {/* Checkbox */}
      <div className="flex-shrink-0">
        <DexCheckbox
          label={task.title}
          labelHidden
          checked={isDone}
          onCheckedChange={() => toggleTask(task.id)}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 14, fontWeight: 600, color: '#2C2C2C', textDecoration: isDone ? 'line-through' : 'none' }}>
          {task.title}
        </p>
        <p style={{ fontSize: 12, color: '#656565', marginTop: 1 }}>
          Contact:{' '}
          <span style={{ color: '#006CEB', cursor: 'pointer' }}>{task.contactName}</span>
        </p>
      </div>

      <div className="flex-shrink-0 text-right">
        <p style={{ fontSize: 12, color: '#E02500', fontWeight: 500 }}>{task.dueDate}</p>
        <p style={{ fontSize: 11, color: '#E02500', opacity: 0.75 }}>Past due</p>
      </div>
    </div>
  )
}
