import React from "react";
import { Eye } from "lucide-react";
export const Logo = () => {
  return (
    <div>
      <div className="relative group flex justify-center items-center">
        <Eye></Eye>
      </div>
      <div className="relative group flex justify-center items-center">
        <div
          className="p-3"
          style={{
            width: "329px",
            height: "59px",
          }}
        >
          <h2 className="text-3xl lg:text-5xl text-center text-black mb-1 lowercase font-poppins">you should watch</h2>
        </div>
      </div>
    </div>
  );
};
