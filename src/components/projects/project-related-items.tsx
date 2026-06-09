"use client";

import { useState } from "react";

import { Button } from "~/components/ui/button";
import { ChipSelect } from "~/components/ui/chip-select";
import { Input } from "~/components/ui/input";
import type { RouterOutputs } from "~/trpc/react";
import { api } from "~/trpc/react";

type Detail = RouterOutputs["project"]["getById"];

export function ProjectRelatedItems({
  projectId,
  detail,
  onChanged,
}: {
  projectId: string;
  detail: Detail;
  onChanged: () => void;
}) {
  const [eventTitle, setEventTitle] = useState("");
  const [eventType, setEventType] = useState<"meeting" | "appointment" | "obligation">("meeting");
  const [eventDate, setEventDate] = useState("");
  const [eventStart, setEventStart] = useState("09:00");
  const [eventEnd, setEventEnd] = useState("10:00");
  const [adHocTitle, setAdHocTitle] = useState("");
  const [urgencyBoost, setUrgencyBoost] = useState(0.5);
  const [error, setError] = useState("");

  const createEvent = api.fixedEvent.create.useMutation({
    onSuccess: () => {
      setEventTitle("");
      setError("");
      onChanged();
    },
    onError: (err) => setError(err.message),
  });

  const deleteEvent = api.fixedEvent.delete.useMutation({
    onSuccess: onChanged,
    onError: (err) => setError(err.message),
  });
  const createAdHoc = api.adHoc.create.useMutation({
    onSuccess: () => {
      setAdHocTitle("");
      setError("");
      onChanged();
    },
    onError: (err) => setError(err.message),
  });
  const deleteAdHoc = api.adHoc.delete.useMutation({
    onSuccess: onChanged,
    onError: (err) => setError(err.message),
  });

  return (
    <div className="space-y-6 border-t pt-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Add fixed event</h3>
        <div className="space-y-2">
          <Input
            placeholder="Title"
            value={eventTitle}
            onChange={(e) => setEventTitle(e.target.value)}
          />
          <ChipSelect
            label="Event type"
            value={eventType}
            onChange={setEventType}
            options={[
              { value: "meeting", label: "Meeting" },
              { value: "appointment", label: "Appointment" },
              { value: "obligation", label: "Obligation" },
            ]}
          />
          <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="time" value={eventStart} onChange={(e) => setEventStart(e.target.value)} />
            <Input type="time" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} />
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={createEvent.isPending || !eventTitle || !eventDate}
            onClick={() =>
              createEvent.mutate({
                title: eventTitle,
                eventType,
                date: eventDate,
                startTime: eventStart,
                endTime: eventEnd,
                projectId,
              })
            }
          >
            {createEvent.isPending ? "Adding…" : "Add event"}
          </Button>
        </div>
        <ul className="mt-3 space-y-2">
          {detail.project.fixedEvents.map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
              <span>
                {e.title} · {e.date.toISOString().split("T")[0]} {e.startTime}–{e.endTime}
              </span>
              <button
                type="button"
                className="text-red-600"
                onClick={() => deleteEvent.mutate({ id: e.id })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Add ad-hoc boost</h3>
        <div className="space-y-2">
          <Input
            placeholder="Title"
            value={adHocTitle}
            onChange={(e) => setAdHocTitle(e.target.value)}
          />
          <ChipSelect
            label="Urgency boost"
            value={String(urgencyBoost)}
            onChange={(v) => setUrgencyBoost(Number(v))}
            options={[
              { value: "0.25", label: "Low (0.25)" },
              { value: "0.5", label: "Medium (0.5)" },
              { value: "0.75", label: "High (0.75)" },
              { value: "1", label: "Critical (1.0)" },
            ]}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={createAdHoc.isPending || !adHocTitle.trim()}
            onClick={() =>
              createAdHoc.mutate({ title: adHocTitle, projectId, urgencyBoost })
            }
          >
            Add
          </Button>
        </div>
        <ul className="mt-3 space-y-2">
          {detail.project.adHocItems.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
              <span>{a.title}</span>
              <button
                type="button"
                className="text-red-600"
                onClick={() => deleteAdHoc.mutate({ id: a.id })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
