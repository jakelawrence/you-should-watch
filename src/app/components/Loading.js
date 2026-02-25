import React from "react";
import Image from "next/image";

export default function Loading() {
  return (
    <div className="animate-spin">
      <Image src="/images/eye-white.png" alt="Logo" width={50} height={50} className="mx-auto" />
    </div>
  );
}
